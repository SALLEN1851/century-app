'use client'

import { useEffect, useMemo, useState } from 'react'

type Focus = 'endurance' | 'tempo' | 'climbing' | 'recovery'
type Surface = 'any' | 'paved' | 'gravel' | 'mixed'
type Heat = 'cool' | 'mild' | 'hot'

type Signals = {
  recovery?: number | null
  weekStrain?: number | null
}
type Segment = {
  kind: 'flat' | 'rolling' | 'climb' | 'descend'
  minutes: number
  avgGradePct: number
  estMph: number
  miles: number
  elevGainFt: number
  cue?: string
}
type Zones = { Z1: number; Z2: number; Z3: number }
type FuelPerHour = { carbs_g: number; fluids_L: number; sodium_mg: number }
type FuelTotals = FuelPerHour & { hours: number }
type Checkpoint = { atMin: number; atMi: number; action: string; details?: string }

export default function GravaFlowPlanner({
  whoopData,
  goal,
  className = '',
  bodyKg = 75,
}: {
  whoopData?: any
  goal?: any
  className?: string
  bodyKg?: number
}) {
  // ---------- Inputs ----------
  const [minutes, setMinutes] = useState(120)
  const [focus, setFocus] = useState<Focus>('endurance')
  const [surface, setSurface] = useState<Surface>('mixed')
  const [heat, setHeat] = useState<Heat>('mild')
  const [startName, setStartName] = useState('Home Loop')

  // persist lightweight prefs
  useEffect(() => {
    const raw = localStorage.getItem('grava.gravaflow')
    if (raw) {
      try {
        const j = JSON.parse(raw)
        if (j.minutes) setMinutes(j.minutes)
        if (j.focus) setFocus(j.focus)
        if (j.surface) setSurface(j.surface)
        if (j.heat) setHeat(j.heat)
        if (j.startName) setStartName(j.startName)
      } catch {}
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('grava.gravaflow', JSON.stringify({ minutes, focus, surface, heat, startName }))
  }, [minutes, focus, surface, heat, startName])

  // ---------- WHOOP signals (optional) ----------
  const signals: Signals = useMemo(() => {
    try {
      const recs = whoopData?.recovery?.records ?? []
      const cyc = whoopData?.cycles?.records ?? []
      const recVals = recs
        .map((r: any) => Number(r?.score?.recovery_score))
        .filter((n: any) => Number.isFinite(n))
      const avgRec = recVals.length ? recVals.reduce((a: number,b: number)=>a+b,0)/recVals.length : null
      const byDayMax = new Map<string, number>()
      for (const c of (cyc as any[])) {
        const t = new Date(c?.start ?? '').toISOString().slice(0,10)
        const s = Number(c?.score?.strain ?? 0)
        byDayMax.set(t, Math.max(byDayMax.get(t) ?? 0, s))
      }
      const weekStrain = [...byDayMax.values()].reduce((a,b)=>a+b,0)
      return { recovery: avgRec, weekStrain }
    } catch { return { recovery: null, weekStrain: null } }
  }, [whoopData])

  // ---------- Plan generation ----------
  const [plan, setPlan] = useState<{
    segments: Segment[]
    zones: Zones
    fuelPerHour: FuelPerHour
    fuelTotals: FuelTotals
    checkpoints: Checkpoint[]
    distanceMi: number
    elevFt: number
  } | null>(null)

  function generate() {
    const seed = hash(`${minutes}|${focus}|${surface}|${heat}|${startName}|${Math.round(signals.recovery ?? 50)}`)
    const rng = mulberry32(seed)

    const segs = buildSegments({ minutes, focus, surface, rng })
    const { distanceMi, elevFt } = summarizeRoute(segs)
    const zones = doseZones({ focus, minutes, signals })
    const intensity = zonesToIntensity(zones) // 1.0 easy .. 1.5 hard
    const env = heatToEnv(heat)
    const fuelPerHour = calcFuelPerHour({ intensity, env })
    const hours = minutes / 60
    const fuelTotals: FuelTotals = {
      hours,
      carbs_g: fuelPerHour.carbs_g * hours,
      fluids_L: fuelPerHour.fluids_L * hours,
      sodium_mg: fuelPerHour.sodium_mg * hours,
    }
    const checkpoints = buildCheckpoints({ segs, fuelPerHour, env, rng })

    setPlan({ segments: segs, zones, fuelPerHour, fuelTotals, checkpoints, distanceMi, elevFt })
  }

  useEffect(() => { generate() /* auto-generate on first mount + when inputs change */ }, [
    minutes, focus, surface, heat, startName, signals.recovery
  ])

  // ---------- UI ----------
  return (
    <section className={`rounded-2xl border border-stone-200/60 dark:border-stone-800/70 p-5 bg-white/60 dark:bg-stone-950/40 backdrop-blur ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">GravaFlow (Prototype)</h3>
          <p className="text-xs text-stone-500">
            Build a physiology-aware route & fueling plan
          </p>
          {goal?.goalText && (
            <p className="mt-1 text-[11px] text-stone-500">
              Goal: <span className="font-medium">{goal.goalText}</span>{goal.eventDate ? ` • Target: ${goal.eventDate}` : ''}
            </p>
          )}
          {signals.recovery != null && (
            <p className="mt-1 text-[11px] text-stone-500">
              WHOOP avg recovery (recent): <span className="font-medium">{signals.recovery.toFixed(0)}</span>/100
            </p>
          )}
        </div>
        <button
          onClick={generate}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          Regenerate
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
        <div className="md:col-span-2">
          <label className="text-[11px] text-stone-500">Start/Route name</label>
          <input
            value={startName}
            onChange={(e)=>setStartName(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2"
            placeholder="Home Loop"
          />
        </div>
        <div>
          <label className="text-[11px] text-stone-500">Time budget (min)</label>
          <input
            type="number" min={30} max={360} step={15}
            value={minutes}
            onChange={(e)=>setMinutes(Math.max(30, Math.min(360, Number(e.target.value)||120)))}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-[11px] text-stone-500">Focus</label>
          <select
            value={focus}
            onChange={(e)=>setFocus(e.target.value as Focus)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2"
          >
            <option value="endurance">Endurance (Z2)</option>
            <option value="tempo">Tempo (Z3)</option>
            <option value="climbing">Climbing</option>
            <option value="recovery">Recovery</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone-500">Surface</label>
          <select
            value={surface}
            onChange={(e)=>setSurface(e.target.value as Surface)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2"
          >
            <option value="mixed">Mixed</option>
            <option value="paved">Paved</option>
            <option value="gravel">Gravel</option>
            <option value="any">Any</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone-500">Heat</label>
          <select
            value={heat}
            onChange={(e)=>setHeat(e.target.value as Heat)}
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2"
          >
            <option value="cool">Cool</option>
            <option value="mild">Mild</option>
            <option value="hot">Hot</option>
          </select>
        </div>
      </div>

      {/* Output */}
      {!plan ? (
        <div className="mt-4 rounded-lg border border-stone-200/60 dark:border-stone-800/70 p-3 text-sm">Preparing…</div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Summary */}
          <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <KV label="Estimated time" value={`${minutes} min`} />
              <KV label="Distance" value={`${plan.distanceMi.toFixed(1)} mi`} />
              <KV label="Elevation" value={`${Math.round(plan.elevFt)} ft`} />
              <KV label="Zones (min)" value={`Z1 ${Math.round(plan.zones.Z1)} · Z2 ${Math.round(plan.zones.Z2)} · Z3 ${Math.round(plan.zones.Z3)}`} />
            </div>
          </div>

          {/* Segments */}
          <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
            <div className="mb-2 text-sm font-semibold">Route Segments</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {plan.segments.map((s, i) => (
                <div key={i} className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium capitalize">{s.kind}</div>
                    <div className="text-[11px] text-stone-500">{s.minutes} min</div>
                  </div>
                  <div className="mt-1 text-[12px] text-stone-600 dark:text-stone-300">
                    {s.miles.toFixed(1)} mi · {Math.round(s.elevGainFt)} ft gain · ~{s.estMph.toFixed(1)} mph · {s.avgGradePct.toFixed(1)}%
                  </div>
                  {s.cue && <div className="mt-1 text-[12px] text-stone-500">{s.cue}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Fueling */}
          <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
            <div className="mb-2 text-sm font-semibold">Fueling & Hydration</div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Mini label="Carbs" main={`${Math.round(plan.fuelTotals.carbs_g)} g`} sub={`≈ ${Math.round(plan.fuelPerHour.carbs_g)} g/h`} />
              <Mini label="Fluids" main={`${plan.fuelTotals.fluids_L.toFixed(1)} L`} sub={`≈ ${plan.fuelPerHour.fluids_L.toFixed(1)} L/h`} />
              <Mini label="Sodium" main={`${Math.round(plan.fuelTotals.sodium_mg)} mg`} sub={`≈ ${Math.round(plan.fuelPerHour.sodium_mg)} mg/h`} />
            </div>

            <div className="mt-3 text-sm">
              <div className="mb-1 font-medium">Checkpoints</div>
              <ul className="list-disc pl-5 space-y-1">
                {plan.checkpoints.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium">{fmtMin(c.atMin)}</span> @ {c.atMi.toFixed(1)} mi — {c.action}
                    {c.details ? <span className="text-stone-500"> · {c.details}</span> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => copyPlanToClipboard({ plan, minutes, startName, focus, surface, heat })}
                className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Copy summary
              </button>
              <button
                onClick={() => downloadJSON('gravaflow-plan.json', plan)}
                className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Download JSON
              </button>
              <button
                disabled
                className="rounded-md bg-stone-200 text-stone-600 px-3 py-1.5 text-xs dark:bg-stone-800 dark:text-stone-400 cursor-not-allowed"
                title="Device sync coming soon"
              >
                Send to device (soon)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------------- UI atoms ---------------- */
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}

function Mini({ label, main, sub }: { label: string; main: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="text-lg font-bold">{main}</div>
      {sub && <div className="text-[10px] text-stone-500">{sub}</div>}
    </div>
  )
}

/* ---------------- Core logic ---------------- */
function buildSegments({
  minutes, focus, surface, rng,
}: { minutes: number; focus: Focus; surface: Surface; rng: () => number }): Segment[] {
  const segCount = 6
  const splits = evenishSplits(minutes, segCount, rng)

  const mix = mixByFocus(focus)
  const segKinds: Segment['kind'][] = splits.map(() => pickWeighted(mix, rng))

  return segKinds.map((kind, idx) => {
    const m = splits[idx]
    const baseMph = mphBySurface(surface)
    const grade = avgGradeFor(kind, rng)
    const mph = clamp(
      baseMph *
      (kind === 'climb' ? 0.82 : kind === 'rolling' ? 0.92 : kind === 'descend' ? 1.08 : 1.0),
      8, 26
    )
    const miles = (m / 60) * mph
    const elevGainFt = Math.max(0, miles * 5280 * (kind === 'descend' ? 0 : grade/100))
    const cue = cueFor(kind, idx)
    return { kind, minutes: m, avgGradePct: grade, estMph: mph, miles, elevGainFt, cue }
  })
}

function summarizeRoute(segs: Segment[]) {
  const distanceMi = segs.reduce((a,s)=>a+s.miles, 0)
  const elevFt = segs.reduce((a,s)=>a+s.elevGainFt, 0)
  return { distanceMi, elevFt }
}

function doseZones({ focus, minutes, signals }: { focus: Focus; minutes: number; signals: Signals }): Zones {
  // base splits by focus
  let Z1 = 0.20, Z2 = 0.65, Z3 = 0.15
  if (focus === 'tempo') { Z1 = 0.15; Z2 = 0.55; Z3 = 0.30 }
  if (focus === 'climbing') { Z1 = 0.15; Z2 = 0.50; Z3 = 0.35 }
  if (focus === 'recovery') { Z1 = 0.35; Z2 = 0.60; Z3 = 0.05 }

  // nudge based on WHOOP recovery
  const rec = signals.recovery ?? 55
  if (rec < 50) { Z3 *= 0.6; Z2 *= 0.9; Z1 = 1 - (Z2 + Z3) }
  if (rec > 70) { Z3 *= 1.15; Z2 *= 1.0; Z1 = 1 - (Z2 + Z3) }

  const total = minutes
  return { Z1: total*Z1, Z2: total*Z2, Z3: total*Z3 }
}

function zonesToIntensity(z: Zones) {
  const total = z.Z1 + z.Z2 + z.Z3 || 1
  const w = (z.Z1*1.0 + z.Z2*1.2 + z.Z3*1.4) / total
  return w // 1.0..1.4
}

function heatToEnv(h: Heat) {
  return {
    fluidsMult: h === 'hot' ? 1.25 : h === 'mild' ? 1.0 : 0.9,
    sodiumMult: h === 'hot' ? 1.25 : 1.0,
  }
}

function calcFuelPerHour({ intensity, env }: { intensity: number; env: { fluidsMult: number; sodiumMult: number } }): FuelPerHour {
  // starting points; tune later
  const carbs = clamp(40 + (intensity - 1.0) * 100, 40, 90) // 40–90 g/h
  const fluids = clamp(0.5 + (intensity - 1.0) * 1.0, 0.5, 1.2) * env.fluidsMult // L/h
  const sodium = clamp(400 + (intensity - 1.0) * 800, 400, 1000) * env.sodiumMult // mg/h
  return { carbs_g: Math.round(carbs), fluids_L: +fluids.toFixed(2), sodium_mg: Math.round(sodium) }
}

function buildCheckpoints({
  segs, fuelPerHour, env, rng,
}: {
  segs: Segment[]
  fuelPerHour: FuelPerHour
  env: { fluidsMult: number; sodiumMult: number }
  rng: () => number
}): Checkpoint[] {
  const minutes = segs.reduce((a,s)=>a+s.minutes,0)
  const distance = segs.reduce((a,s)=>a+s.miles,0)
  const cps: Checkpoint[] = []
  // every ~30min carbs, every ~20–30min drink, refills around halfway & 75%
  for (let t=30; t<=minutes; t+=30) {
    const mi = (t/minutes)*distance
    cps.push({ atMin: t, atMi: mi, action: 'Carbs', details: '≈ 30–40 g' })
  }
  for (let t=20; t<=minutes; t+=25) {
    const mi = (t/minutes)*distance
    cps.push({ atMin: t, atMi: mi, action: 'Drink', details: `~${fuelPerHour.fluids_L.toFixed(1)} L/h, ${Math.round(fuelPerHour.sodium_mg)} mg Na/h` })
  }
  // mock POIs for refills
  const poi = ['Park Fountain','Corner Store','Trailhead Tap','Cafe Stop']
  const refillTimes = [Math.round(minutes*0.5), Math.round(minutes*0.75)]
  for (const t of refillTimes) {
    if (t >= 35 && t <= minutes-20) {
      const mi = (t/minutes)*distance
      cps.push({ atMin: t, atMi: mi, action: 'Refill', details: `${poi[Math.floor(rng()*poi.length)]} • mix ${Math.round(fuelPerHour.sodium_mg)}/L` })
    }
  }
  // sort by time
  cps.sort((a,b)=>a.atMin-b.atMin)
  return dedupeByKey(cps, c=>`${c.atMin}|${c.action}`) // tidy duplicates
}

/* ---------------- helpers ---------------- */
function evenishSplits(totalMin: number, parts: number, rng: () => number) {
  const base = Math.floor(totalMin / parts)
  let rem = totalMin - base*parts
  const arr = Array(parts).fill(base)
  // spread remaining minutes
  while (rem > 0) {
    const i = Math.floor(rng()*parts)
    arr[i] += 1; rem -= 1
  }
  // small jitter
  for (let i=0;i<parts;i++){
    const j = Math.floor((rng()-0.5)*2) // -1/0/+1
    arr[i] = Math.max(8, arr[i] + j)
  }
  // re-normalize to totalMin
  const diff = totalMin - arr.reduce((a,b)=>a+b,0)
  if (diff !== 0) arr[0] += diff
  return arr
}
function pickWeighted(weights: Record<string, number>, rng: () => number) {
  const sum = Object.values(weights).reduce((a,b)=>a+b,0)
  let r = rng()*sum
  for (const [k,v] of Object.entries(weights)) {
    if ((r-=v) <= 0) return k as Segment['kind']
  }
  return Object.keys(weights)[0] as Segment['kind']
}
function mixByFocus(f: Focus): Record<Segment['kind'], number> {
  if (f === 'tempo') return { flat: 2, rolling: 3, climb: 2, descend: 1 }
  if (f === 'climbing') return { flat: 1, rolling: 2, climb: 4, descend: 1 }
  if (f === 'recovery') return { flat: 4, rolling: 1, climb: 0.5, descend: 1.5 }
  return { flat: 3, rolling: 3, climb: 1.5, descend: 1 } // endurance
}
function mphBySurface(s: Surface) {
  if (s === 'paved') return 17
  if (s === 'gravel') return 14
  if (s === 'mixed') return 15.5
  return 15.5
}
function avgGradeFor(kind: Segment['kind'], rng: () => number) {
  if (kind === 'climb') return 4 + rng()*3 // 4–7%
  if (kind === 'rolling') return 1 + rng()*2 // 1–3%
  if (kind === 'descend') return -2 - rng()*3 // -2 to -5 (not used in gain)
  return 0.3 + rng()*0.5 // flat-ish
}
function cueFor(kind: Segment['kind'], idx: number) {
  if (kind === 'climb') return 'Steady seated; cap at low Z3.'
  if (kind === 'rolling') return 'Surf the rollers; keep Z2 average.'
  if (kind === 'descend') return 'Relax & fuel; free speed.'
  return idx === 0 ? 'Easy roll-out; warm up 10–15 min.' : 'Keep cadence smooth.'
}
function fmtMin(m: number) {
  const h = Math.floor(m/60); const mm = m%60
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
function dedupeByKey<T>(arr: T[], key: (x:T)=>string) {
  const seen = new Set<string>(); const out: T[] = []
  for (const x of arr) { const k = key(x); if (!seen.has(k)) { seen.add(k); out.push(x) } }
  return out
}
function hash(s: string) { // simple string hash → seed
  let h = 2166136261 >>> 0
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function copyPlanToClipboard({
  plan, minutes, startName, focus, surface, heat
}: {
  plan: any; minutes: number; startName: string; focus: string; surface: string; heat: string
}) {
  const txt =
`GravaFlow Plan — ${startName}
Time: ${minutes} min • Distance: ${plan.distanceMi.toFixed(1)} mi • Elev: ${Math.round(plan.elevFt)} ft
Zones: Z1 ${Math.round(plan.zones.Z1)} · Z2 ${Math.round(plan.zones.Z2)} · Z3 ${Math.round(plan.zones.Z3)}
Surface: ${surface} • Focus: ${focus} • Heat: ${heat}

Fuel (per hour): ${Math.round(plan.fuelPerHour.carbs_g)} g carbs • ${plan.fuelPerHour.fluids_L.toFixed(1)} L • ${Math.round(plan.fuelPerHour.sodium_mg)} mg Na
Fuel (total): ${Math.round(plan.fuelTotals.carbs_g)} g • ${plan.fuelTotals.fluids_L.toFixed(1)} L • ${Math.round(plan.fuelTotals.sodium_mg)} mg

Checkpoints:
${plan.checkpoints.map((c:any)=>`- ${fmtMin(c.atMin)} @ ${c.atMi.toFixed(1)} mi — ${c.action}${c.details?` (${c.details})`:''}`).join('\n')}
`
  navigator.clipboard.writeText(txt).catch(()=>{})
}
function downloadJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
