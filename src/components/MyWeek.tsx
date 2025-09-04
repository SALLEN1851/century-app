'use client'

import { useEffect, useMemo, useState } from 'react'
import { fullDayNutrition, Tone } from '@/lib/grava/nutrition'

/** ---------- tiny utils ---------- */
const lastOf = (arr: any[]) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** ---------- UI atoms ---------- */
const chip = (tone: 'easy'|'moderate'|'hard'|'rest') => {
  const map = {
    easy:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    moderate:'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    hard:    'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    rest:    'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200',
  }
  return `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${map[tone]}`
}

function KVP({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-[10px] text-stone-500">{sub}</div>}
    </div>
  )
}

function MiniKVP({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-100/70 dark:bg-stone-900/60 px-2 py-1 text-[11px]">
      <span className="text-stone-500">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function DayCard({
  day, tone, miles, elev, note, durH, nutri,
}: any) {
  const ride = nutri.ride_total
  const perh = nutri.per_h
  const pre  = nutri.segments.pre
  const post = nutri.segments.post
  const daily= nutri.day_total

  return (
    <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 bg-white/70 dark:bg-stone-900/70 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{day}</h4>
        <span className={chip(tone)}>{tone}</span>
      </div>

      {/* Training */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <KVP label="Miles" value={miles ?? '—'} />
        <KVP label="Elevation" value={elev ? `${elev} ft` : '—'} />
        <KVP label="Duration" value={`${durH.toFixed(1)} h`} sub={tone === 'rest' ? '—' : 'est.'} />
        <KVP label="Intensity" value={tone} />
      </div>

      {/* DURING-RIDE Nutrition */}
      <div className="mt-4 rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-3">
        <div className="mb-2 text-sm font-semibold">During-Ride Fueling</div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
            <div className="text-[11px] text-stone-500">Carbs</div>
            <div className="text-lg font-bold">{Math.round(ride.carbs_g)} g</div>
            <div className="text-[10px] text-stone-500">≈ {Math.round(perh.carbs_g)} g/h</div>
          </div>
          <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
            <div className="text-[11px] text-stone-500">Fluids</div>
            <div className="text-lg font-bold">{ride.fluids_L.toFixed(1)} L</div>
            <div className="text-[10px] text-stone-500">≈ {perh.fluids_L.toFixed(1)} L/h</div>
          </div>
          <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
            <div className="text-[11px] text-stone-500">Sodium</div>
            <div className="text-lg font-bold">{Math.round(ride.sodium_mg)} mg</div>
            <div className="text-[10px] text-stone-500">≈ {Math.round(perh.sodium_mg)} mg/h</div>
          </div>
        </div>
      </div>

      {/* PRE / POST */}
      {tone !== 'rest' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-3">
            <div className="mb-2 text-sm font-semibold">Pre-Ride (60–90m)</div>
            <div className="grid grid-cols-2 gap-2">
              <MiniKVP label="Carbs" value={`${Math.round(pre.carbs_g)} g`} />
              <MiniKVP label="Fluids" value={`${pre.fluids_L.toFixed(1)} L`} />
              <MiniKVP label="Sodium" value={`${Math.round(pre.sodium_mg)} mg`} />
              {'caffeine_mg' in pre && pre.caffeine_mg != null && <MiniKVP label="Caffeine" value={`${pre.caffeine_mg} mg`} />}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-3">
            <div className="mb-2 text-sm font-semibold">Post-Ride (0–2h)</div>
            <div className="grid grid-cols-2 gap-2">
              <MiniKVP label="Carbs" value={`${Math.round(post.carbs_g)} g`} />
              <MiniKVP label="Protein" value={`${Math.round(post.protein_g)} g`} />
              <MiniKVP label="Fluids" value={`${post.fluids_L.toFixed(1)} L`} />
              <MiniKVP label="Sodium" value={`${Math.round(post.sodium_mg)} mg`} />
            </div>
          </div>
        </div>
      )}

      {/* Daily total */}
      <div className="mt-3 rounded-lg bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2 text-[12px]">
        <span className="text-stone-500 mr-2">Daily total:</span>
        <span className="font-semibold">
          {Math.round(daily.carbs_g)} g carbs · {Math.round(daily.protein_g)} g protein · {daily.fluids_L.toFixed(1)} L · {Math.round(daily.sodium_mg)} mg Na
        </span>
      </div>

      {note && <p className="mt-3 text-xs text-stone-500 leading-relaxed">{note}</p>}
    </div>
  )
}

/** ---------- Heuristic plan (fallback if /api/coach/week not used) ---------- */
function buildHeuristicWeek(s: any) {
  const rec = s?.recovery ?? 50
  const debt = s?.sleepDebtH ?? 0
  const loadAdj = s?.lastLoadBal ? clamp(1 - (s.lastLoadBal/15)*0.15, 0.85, 1.05) : 1

  const base = 25 + (rec/100)*(70-25)
  const debtPenalty = Math.pow(0.94, debt)
  const weeklyMiles = clamp(base * debtPenalty * loadAdj, 18, 80)

  const weights = { Mon:0.10, Tue:0.18, Wed:0.14, Thu:0.18, Fri:0.12, Sat:0.22, Sun:0.06 }
  const tones: Record<string, Tone> = { Mon:'easy', Tue:'moderate', Wed:'moderate', Thu:'moderate', Fri:'easy', Sat:'hard', Sun:'easy' }

  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => {
    let miles = weeklyMiles * (weights as any)[d]
    if (tones[d] === 'hard') miles *= 1.05
    miles = Math.round(miles * 2) / 2
    const ftPerMi = tones[d] === 'hard' ? 95 : 80
    const elev = Math.round(miles * ftPerMi)
    const note =
      tones[d] === 'hard'
        ? 'Quality session: tempo / low Z3. Fuel 60–90 g/h.'
        : 'Aerobic focus. Smooth cadence; short hills okay.'
    return { day: d, miles, elev, tone: tones[d], note }
  })
}

/** ---------- MAIN COMPONENT ---------- */
export default function MyWeek({
  whoopData,
  stacked = false,   // set true on /week page for vertical stack
  bodyKg = 75,       // personalize fueling
}: {
  whoopData?: any
  stacked?: boolean
  bodyKg?: number
}) {
  const [plan, setPlan] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)

  // WHOOP signals
  const signals = useMemo(() => {
    const rec = lastOf(whoopData?.recovery?.records || [])
    const cyc = whoopData?.cycles?.records || []
    const recovery = rec?.score?.recovery_score ?? null
    const lastLoadBal = lastOf(cyc)?.score?.strain ?? null
    const slp = lastOf(whoopData?.sleep?.records || [])
    const sleepDebtH = slp?.score?.sleep_needed_baseline_milli
      ? Math.max(0, (slp.score.sleep_needed_baseline_milli - (slp.score.stage_summary?.total_in_bed_time_milli || 0)) / 1000 / 3600)
      : null
    return { recovery, sleepDebtH, lastLoadBal }
  }, [whoopData])

  // Try AI (/api/coach/week); fallback to heuristic
  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/coach/week', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ whoopSignals: signals }),
        })
        if (r.ok) {
          const j = await r.json()
          if (!ignore && Array.isArray(j?.week)) {
            setPlan(j.week)
            setLoading(false)
            return
          }
        }
      } catch {}
      if (!ignore) {
        setPlan(buildHeuristicWeek(signals))
        setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [signals?.recovery, signals?.sleepDebtH, signals?.lastLoadBal])

  const show = plan || buildHeuristicWeek(signals)

  // Augment each day with duration + nutrition (pre/during/post + totals)
  const enriched = show.map((d: any) => {
    const n = fullDayNutrition({ miles: d.miles || 0, elevFt: d.elev || 0, tone: d.tone as Tone, bodyKg })
    return {
      ...d,
      durH: n.durH,
      nutri: {
        per_h: n.per_h,
        ride_total: n.during,
        segments: { pre: n.pre, post: n.post },
        day_total: n.totals,
      },
    }
  })

  const weeklyTotals = enriched.reduce(
    (a: any, d: any) => ({
      miles: a.miles + (d.miles || 0),
      elev: a.elev + (d.elev || 0),
      carbs: a.carbs + d.nutri.ride_total.carbs_g,
      fluids: a.fluids + d.nutri.ride_total.fluids_L,
      sodium: a.sodium + d.nutri.ride_total.sodium_mg,
      dayCarbs: a.dayCarbs + d.nutri.day_total.carbs_g,
      dayProtein: a.dayProtein + d.nutri.day_total.protein_g,
      dayFluids: a.dayFluids + d.nutri.day_total.fluids_L,
      daySodium: a.daySodium + d.nutri.day_total.sodium_mg,
    }),
    { miles: 0, elev: 0, carbs: 0, fluids: 0, sodium: 0, dayCarbs: 0, dayProtein: 0, dayFluids: 0, daySodium: 0 }
  )

  if (loading && !plan) {
    return <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4 text-sm">Building your week…</div>
  }

  return (
    <section className="rounded-2xl border border-stone-200/60 dark:border-stone-800/70 p-5 bg-white/60 dark:bg-stone-950/40 backdrop-blur">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">My Week</h3>
          <p className="text-xs text-stone-500">WHOOP-aware training + pre/during/post nutrition</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-stone-500">Weekly totals (ride-only)</div>
          <div className="text-sm font-semibold">
            {weeklyTotals.miles.toFixed(0)} mi · {weeklyTotals.elev.toFixed(0)} ft
          </div>
          <div className="text-[11px] text-stone-500">
            {Math.round(weeklyTotals.carbs)} g carbs · {weeklyTotals.fluids.toFixed(1)} L · {Math.round(weeklyTotals.sodium)} mg Na
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            <span className="font-medium">Daily totals (incl. pre/post/baseline):</span><br/>
            {Math.round(weeklyTotals.dayCarbs)} g carbs · {Math.round(weeklyTotals.dayProtein)} g protein · {weeklyTotals.dayFluids.toFixed(1)} L · {Math.round(weeklyTotals.daySodium)} mg Na
          </div>
        </div>
      </div>

      <div className={stacked ? 'flex flex-col gap-4' : 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4'}>
        {enriched.map((d: any, i: number) => (
          <DayCard key={i} {...d} />
        ))}
      </div>
    </section>
  )
}
