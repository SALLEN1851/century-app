'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import MyWeek from '@/components/MyWeek'
import WeeklyAIOverview from '@/components/WeeklyAIOverview'
import GravaMealsPlanner from '@/components/GravaMealsPlanner'

export default function WeekPage() {
  const { status } = useSession()
  const [whoopData, setWhoopData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [goal, setGoal] = useState<any>(null) // ← define goal

  // hydrate goal from localStorage (optional)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('grava.goal')
      if (raw) setGoal(JSON.parse(raw))
    } catch {}
  }, [])

  // fetch WHOOP data
  useEffect(() => {
    if (status !== 'authenticated') return
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const [cyclesRes, recoveryRes, sleepRes] = await Promise.all([
          fetch('/api/whoop/cycles'),
          fetch('/api/whoop/recovery'),
          fetch('/api/whoop/sleep'),
        ])
        for (const r of [cyclesRes, recoveryRes, sleepRes]) {
          if (!r.ok) throw new Error(`Fetch failed: ${new URL(r.url).pathname} (${r.status})`)
        }
        const [cycles, recovery, sleep] = await Promise.all([
          cyclesRes.json(), recoveryRes.json(), sleepRes.json(),
        ])
        setWhoopData({ cycles, recovery, sleep })
      } catch (e: any) {
        setError(e.message || 'Unknown error')
      } finally {
        setLoading(false)
      }
    })()
  }, [status])

  if (status === 'loading') return <div className="p-6 text-sm">Loading session…</div>
  if (status === 'unauthenticated') return <div className="grid min-h-[60vh] place-items-center text-sm">Please sign in to view My Week.</div>

  return (
    <main className="lg:pl-72">
      <div className="xl:pr-96">
        <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6 space-y-6">
          <h1 className="text-xl font-bold">My Week</h1>

          {/* AI overview (reads goal from state) */}
          <WeeklyAIOverview whoopData={whoopData} goal={goal} className="mb-6" />

          {/* Weekly plan */}
          {loading && !whoopData ? (
            <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4 text-sm">
              Fetching WHOOP data…
            </div>
          ) : (
            <MyWeek whoopData={whoopData} stacked />
          )}

          {/* Meals planner (reads goal from state, can update goal) */}
          <GravaMealsPlanner whoopData={whoopData} goal={goal} setGoal={setGoal} />
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              Error: {error}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
