'use client'

import { useEffect, useMemo, useState } from 'react'
import { Disclosure } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

type Workout = any

type Props = {
  workouts?: Workout[] | { records?: Workout[] }
  weekStartsOnMonday?: boolean
  className?: string
  defaultOpen?: boolean
}

export default function WeeklyTrainingTime({
  workouts,
  weekStartsOnMonday = true,
  className = '',
  defaultOpen = false,
}: Props) {
  const [remote, setRemote] = useState<Workout[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch if workouts not provided
  useEffect(() => {
    if (workouts) return
    let ignore = false
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const r = await fetch('/api/whoop/workouts', { cache: 'no-store' })
        if (!r.ok) throw new Error(`Fetch failed: /api/whoop/workouts (${r.status})`)
        const j = await r.json()
        const list: Workout[] = Array.isArray(j) ? j : (Array.isArray(j?.records) ? j.records : [])
        if (!ignore) setRemote(list)
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Error loading workouts')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [workouts])

  const items: Workout[] = useMemo(() => {
    if (Array.isArray(workouts)) return workouts
    if (Array.isArray((workouts as any)?.records)) return (workouts as any).records
    return remote || []
  }, [workouts, remote])

  // --- Week window (local time) ---
  const now = new Date()
  const weekStart = startOfWeek(now, weekStartsOnMonday ? 1 : 0)
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)

  // --- Sum durations within week (and per day) ---
  const { totalSec, perDaySec } = useMemo(() => {
    const per: number[] = Array(7).fill(0)
    let sum = 0

    for (const w of items) {
      const { s, e } = getWorkoutWindow(w)
      if (!s || !e) continue

      const start = new Date(Math.max(s.getTime(), weekStart.getTime()))
      const end = new Date(Math.min(e.getTime(), weekEnd.getTime()))
      if (end <= start) continue

      sum += (end.getTime() - start.getTime()) / 1000

      // bucket into days
      let cur = new Date(start)
      while (cur < end) {
        const dayIdx = Math.floor((startOfDay(cur).getTime() - weekStart.getTime()) / DAY_MS)
        const nextMidnight = startOfDay(new Date(cur.getTime() + DAY_MS))
        const sliceEnd = new Date(Math.min(nextMidnight.getTime(), end.getTime()))
        const sliceSec = (sliceEnd.getTime() - cur.getTime()) / 1000
        if (dayIdx >= 0 && dayIdx < 7) per[dayIdx] += sliceSec
        cur = sliceEnd
      }
    }

    return { totalSec: sum, perDaySec: per }
  }, [items, weekStart.getTime(), weekEnd.getTime()])

  const totalFmt = fmtHM(totalSec)
  const dayLabels = weekStartsOnMonday
    ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  if (error) {
    return (
      <div className={`rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 p-4 ${className}`}>
        {error}
      </div>
    )
  }

  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <section className={`rounded-2xl border border-stone-200/60 dark:border-stone-800/70 bg-white/60 dark:bg-stone-950/40 backdrop-blur ${className}`}>
          {/* Header / toggle button */}
          <Disclosure.Button className="w-full px-5 py-4 text-left">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">Weekly Training Time</h3>
                <p className="text-xs text-stone-500">
                  {weekStart.toLocaleDateString()} – {new Date(weekEnd.getTime() - 1).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-stone-500">Total this week</div>
                  <div className="text-xl font-extrabold">{loading && !items.length ? '—' : totalFmt}</div>
                </div>
                <ChevronDownIcon
                  className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} text-stone-500`}
                  aria-hidden="true"
                />
              </div>
            </div>
          </Disclosure.Button>

          {/* Panel */}
          <Disclosure.Panel className="px-5 pb-5">
            {loading && !items.length ? (
              <div className="rounded-lg border border-stone-200/60 dark:border-stone-800/70 p-3 text-sm">Loading…</div>
            ) : (
              <ul className="divide-y divide-stone-200/60 dark:divide-stone-800/60">
                {perDaySec.map((sec, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-stone-600 dark:text-stone-300">{dayLabels[i]}</span>
                    <span className="font-medium">{fmtHM(sec)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Disclosure.Panel>
        </section>
      )}
    </Disclosure>
  )
}

/* ================= helpers ================= */
const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1) {
  const day = d.getDay() // 0..6
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day
  const start = new Date(d)
  start.setDate(d.getDate() + diff)
  return startOfDay(start)
}

function getWorkoutWindow(w: any): { s: Date | null; e: Date | null } {
  const startStr = w.start || w.start_time || w.startTime || w.created_at
  const endStr   = w.end || w.end_time || w.endTime
  const durSec = num(w.duration_sec) ?? num(w.duration_s) ?? num(w.duration) ?? num(w.score?.duration)
  const s = startStr ? new Date(startStr) : null
  let e = endStr ? new Date(endStr) : null
  if (!e && s && typeof durSec === 'number') e = new Date(s.getTime() + durSec * 1000)
  return { s, e }
}

function num(x: any): number | null {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function fmtHM(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}
