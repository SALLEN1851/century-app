// app/api/walmart/search/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'realtime-walmart-data.p.rapidapi.com'

// Helper: call an endpoint with given params
async function callRapid(url: string, params: Record<string, string>) {
  const u = new URL(url)
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  const res = await fetch(u.toString(), {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY || '',
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
    // Keep it simple; no caching
    method: 'GET',
    cache: 'no-store',
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, text, json }
}

// Normalize different payload shapes into a simple array
function normalizeResults(data: any) {
  const arr =
    data?.results ??
    data?.items ??
    data?.data ??
    data?.products ??
    []

  return (Array.isArray(arr) ? arr : []).map((it: any) => {
    const title = it.title ?? it.name ?? it.product_title ?? it.product_name ?? ''
    const price =
      it.price ?? it.offer_price ?? it.salePrice ?? it.current_price ??
      (typeof it.primaryOffer?.offerPrice === 'number' ? it.primaryOffer.offerPrice : null)
    const image = it.image ?? it.product_image ?? it.thumbnail ?? it.image_url ?? null
    const url = it.url ?? it.product_url ?? it.link ?? it.product_page_url ?? null
    return { title, price: typeof price === 'number' ? price : null, image, url }
  })
}

// Some RapidAPI providers expose slightly different paths/params.
// We'll try a few in sequence until one works.
const CANDIDATES = [
  { url: `https://${RAPIDAPI_HOST}/search`, params: (q: string) => ({ query: q, page: '1' }) },
  { url: `https://${RAPIDAPI_HOST}/search-by-keyword`, params: (q: string) => ({ keyword: q, page: '1' }) },
  { url: `https://${RAPIDAPI_HOST}/products/search`, params: (q: string) => ({ q, page: '1' }) },
  // Last resort: rollbacks (not keyworded, but proves connectivity)
  { url: `https://${RAPIDAPI_HOST}/rollbacks`, params: (_q: string) => ({ page: '1' }) },
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const size = Math.max(1, Math.min(10, Number(searchParams.get('size') || 3)))

    if (!q) {
      return NextResponse.json({ results: [], error: { message: 'Missing q' } }, { status: 200 })
    }
    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ results: [], error: { message: 'RAPIDAPI_KEY not set' } }, { status: 200 })
    }

    const errors: Array<{ status: number; body: string; tried: string }> = []

    for (const c of CANDIDATES) {
      const { ok, status, json, text } = await callRapid(c.url, c.params(q))
      if (ok && json) {
        const results = normalizeResults(json).slice(0, size)
        return NextResponse.json({ results }, { status: 200 })
      } else {
        errors.push({ status, body: text?.slice(0, 500) || '', tried: c.url })
      }
    }

    // If we get here, all attempts failed. Return a soft error the UI can ignore.
    return NextResponse.json(
      { results: [], error: { message: 'Upstream error', tries: errors } },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json(
      { results: [], error: { message: e?.message || 'Unknown server error' } },
      { status: 200 }
    )
  }
}
