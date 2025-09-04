'use client'

import { useEffect, useMemo, useState } from 'react'
import { Disclosure } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

type Props = {
  whoopData?: any
  goal?: any                      // pass your {goalText, eventDate, ...} if available
  weekStartsOnMonday?: boolean
  className?: string
  defaultOpen?: boolean
}

export default function WeeklyAIOverview({
  whoopData,
  goal,
  weekStartsOnMonday = true,
  className = '',
  defaultOpen = false,
}: Props) {
  const [{ start, end }, setRange] = useState(() => prevWeekRange(new Date(), weekStartsOnMonday ? 1 : 0))
  const signals = useMemo(() => buildSignals(whoopData, start, end), [whoopData, start.getTime(), end.getTime()])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Try AI summary; fallback if endpoint missing
  async function generate() {
    setLoading(true); setError(null)
    try {
      const body = { goal: goal ?? readStoredGoal(), period: { startISO: start.toISOString(), endISO: end.toISOString() }, signals }
      const r = await fetch('/api/coach/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        const j = await r.json()
        if (j?.summary || j?.recommendations) {
          setSummary({
            text: j.summary ?? '',
            recommendations: j.recommendations ?? heuristicRecommendations(signals, goal ?? readStoredGoal()),
            metrics: quickMetrics(signals),
          })
          setLoading(false)
          return
        }
      }
      // non-OK → fallback
      setSummary(heuristicSummary(signals, goal ?? readStoredGoal()))
    } catch (e: any) {
      setSummary(heuristicSummary(signals, goal ?? readStoredGoal()))
    } finally {
      setLoading(false)
    }
  }

  // (Re)generate on mount or when inputs change
  useEffect(() => { generate() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(signals), JSON.stringify(goal)])

  const metrics = quickMetrics(signals)
  const dateLabel = `${start.toLocaleDateString()} – ${new Date(end.getTime() - 1).toLocaleDateString()}`

  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <section className={`rounded-2xl border border-stone-200/60 dark:border-stone-800/70 bg-white/60 dark:bg-stone-950/40 backdrop-blur ${className}`}>
          {/* Header */}
          <Disclosure.Button className="w-full px-5 py-4 text-left">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">AI Weekly Overview</h3>
                <p className="text-xs text-stone-500">Last week: {dateLabel}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-[11px] text-stone-500">Avg Recovery</div>
                  <div className="text-sm font-semibold">{fmt(metrics.avgRecovery)} / 100</div>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); generate() }}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  {loading ? 'Thinking…' : 'Regenerate'}
                </button>
                <ChevronDownIcon className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} text-stone-500`} />
              </div>
            </div>
          </Disclosure.Button>

          {/* Panel */}
          <Disclosure.Panel className="px-5 pb-5">
            {error && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            )}

            {/* Key metrics */}
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <Stat label="Avg Recovery" value={`${fmt(metrics.avgRecovery)}`} sub="/ 100" />
              <Stat label="Weekly Strain" value={fmt(metrics.weekStrain, 1)} sub="sum of daily max" />
              <Stat label="Sleep (total)" value={`${fmt(metrics.sleepHours, 1)} h`} sub={`${fmt(metrics.avgSleep, 1)} h/nt`} />
              <Stat label="Avg RHR" value={`${fmt(metrics.avgRHR)} bpm`} />
              <Stat label="Avg HRV" value={`${fmt(metrics.avgHRV)} ms`} />
            </div>

            {/* AI / Fallback summary */}
            <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4 text-sm leading-relaxed">
              {loading ? 'Generating summary…' : (summary?.text || defaultSummaryText(metrics, goal ?? readStoredGoal()))}
            </div>

            {/* Recommendations */}
            <div className="mt-4 rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
              <div className="mb-2 text-sm font-semibold">This week, focus on:</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li><span className="font-medium">Recovery:</span> {summary?.recommendations?.recovery}</li>
                <li><span className="font-medium">Sleep:</span> {summary?.recommendations?.sleep}</li>
                <li><span className="font-medium">Strain:</span> {summary?.recommendations?.strain}</li>
              </ul>
              {goal?.goalText && (
                <p className="mt-3 text-[12px] text-stone-500">
                  Goal context: <span className="font-medium">{goal.goalText}</span>{goal.eventDate ? ` • Target: ${goal.eventDate}` : ''}
                </p>
              )}
            </div>
          </Disclosure.Panel>
        </section>
      )}
    </Disclosure>
  )
}

/* =================== tiny UI bits =================== */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-[10px] text-stone-500">{sub}</div>}
    </div>
  )
}

/* =================== signals + helpers =================== */
type Summary = {
  text: string
  recommendations: { recovery: string; sleep: string; strain: string }
  metrics: ReturnType<typeof quickMetrics>
}

function readStoredGoal() {
  try {
    const raw = localStorage.getItem('grava.goal')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function prevWeekRange(now: Date, weekStartsOn: 0 | 1) {
  const thisStart = startOfWeek(now, weekStartsOn)
  const start = new Date(thisStart.getTime() - 7 * DAY_MS)
  const end = new Date(thisStart.getTime()) // exclusive
  return { start, end }
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1) {
  const day = d.getDay() // 0..6 (0 Sun)
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day
  const start = new Date(d)
  start.setDate(d.getDate() + diff)
  start.setHours(0,0,0,0)
  return start
}

const DAY_MS = 24 * 60 * 60 * 1000

function buildSignals(whoop: any, start: Date, end: Date) {
  const recs = whoop?.recovery?.records ?? []
  const sleep = whoop?.sleep?.records ?? []
  const cycles = whoop?.cycles?.records ?? []

  const inRange = (ts: any) => {
    const t = new Date(ts ?? '').getTime()
    return Number.isFinite(t) && t >= start.getTime() && t < end.getTime()
  }

  // Recovery day-level signals
  const recVals: number[] = []
  const rhrVals: number[] = []
  const hrvVals: number[] = []
  for (const r of recs) {
    if (!inRange(r?.timestamp ?? r?.created_at ?? r?.siphon_time)) continue
    const s = r?.score || r?.scores || r
    if (s?.recovery_score != null) recVals.push(Number(s.recovery_score))
    if (s?.resting_heart_rate != null) rhrVals.push(Number(s.resting_heart_rate))
    if (s?.heart_rate_variability_rmssd != null) hrvVals.push(Number(s.heart_rate_variability_rmssd))
  }

  // Sleep totals
  let sleepTotalSec = 0
  const nightly: number[] = []
  for (const s of sleep) {
    if (!inRange(s?.start || s?.start_time || s?.created_at)) continue
    const ms = s?.score?.stage_summary?.total_in_bed_time_milli
    if (typeof ms === 'number' && ms > 0) {
      sleepTotalSec += ms / 1000
      nightly.push(ms / 1000)
    }
  }

  // Strain: take max per day then sum across week
  const byDayMax = new Map<string, number>()
  for (const c of cycles) {
    const st = new Date(c?.start).getTime()
    if (!Number.isFinite(st) || st < start.getTime() || st >= end.getTime()) continue
    const day = new Date(st); day.setHours(0,0,0,0)
    const key = day.toISOString()
    const s = Number(c?.score?.strain ?? 0)
    byDayMax.set(key, Math.max(byDayMax.get(key) ?? 0, s))
  }
  const strainDaily: number[] = [...byDayMax.values()]
  const weekStrain = strainDaily.reduce((a,b) => a + b, 0)

  return {
    avgRecovery: avg(recVals),
    avgRHR: avg(rhrVals),
    avgHRV: avg(hrvVals),
    sleepHours: sleepTotalSec / 3600,
    nights: nightly.map(n => n/3600),
    weekStrain,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  }
}

function quickMetrics(s: ReturnType<typeof buildSignals>) {
  return {
    avgRecovery: s?.avgRecovery ?? null,
    avgRHR: s?.avgRHR ?? null,
    avgHRV: s?.avgHRV ?? null,
    sleepHours: s?.sleepHours ?? 0,
    avgSleep: s?.nights?.length ? (s.sleepHours / s.nights.length) : 0,
    weekStrain: s?.weekStrain ?? 0,
  }
}

function heuristicRecommendations(s: ReturnType<typeof buildSignals>, goal: any) {
  const rec = s?.avgRecovery ?? 50
  const sleepH = s?.avgSleep ?? 7
  const strain = s?.weekStrain ?? 0

  const recovery =
    rec < 45 ? 'Prioritize 1–2 full rest or very easy days early in the week; limit intensity until recovery >55.' :
    rec < 60 ? 'Keep intensity to 1–2 sessions; insert extra easy volume and extend sleep by ~30–60 min.' :
    'You can handle 2–3 quality sessions; keep easy days truly easy and monitor RHR/HRV drift.'

  const sleep =
    sleepH < 7 ? 'Aim for 7.5–8.5h nightly; add a 20–30 min afternoon nap on hard days.' :
    sleepH < 8 ? 'Edge up 15–30 min earlier wind-down; hydrate and fuel in the evening to support sleep.' :
    'Maintain current sleep routine; protect pre-midnight hours for better recovery.'

  const nextLoad =
    strain < 40 ? 'Increase volume 10–15% with one hard session and a longer endurance ride.' :
    strain < 55 ? 'Hold similar load; two quality sessions are appropriate if recovery allows.' :
    'Slight deload (−10–20%) with one quality session; use extra zone 1–2 for aerobic upkeep.'

  const strainText = goal?.weeklyFocus === 'climbing'
    ? `${nextLoad} Include hill reps or sustained climbs on the key day.`
    : nextLoad

  return { recovery, sleep, strain: strainText }
}

function defaultSummaryText(m: ReturnType<typeof quickMetrics>, goal: any) {
  const g = goal?.goalText ? `Goal: ${goal.goalText}. ` : ''
  return `${g}Last week averaged recovery ${fmt(m.avgRecovery)} / 100 with ${fmt(m.sleepHours,1)}h sleep total (${fmt(m.avgSleep,1)}h/nt) and weekly strain ${fmt(m.weekStrain,1)}. Use the focus points below to nudge recovery, sleep, and load for the coming week.`
}

function heuristicSummary(s: ReturnType<typeof buildSignals>, goal: any): Summary {
  const m = quickMetrics(s)
  return {
    text: defaultSummaryText(m, goal),
    recommendations: heuristicRecommendations(s, goal),
    metrics: m,
  }
}

/* ---------- misc ---------- */
function avg(arr: number[]) {
  if (!arr?.length) return null
  return arr.reduce((a,b)=>a+b,0) / arr.length
}

function fmt(n: any, f = 0) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toFixed(f)
}
