// src/components/GoalSetter.tsx
'use client'

import { useEffect, useState } from 'react'

type Goal = {
  goalText: string
  eventDate?: string  // YYYY-MM-DD
  weeklyFocus?: 'endurance' | 'climbing' | 'speed' | 'balanced'
  longRideDay?: 'Sat' | 'Sun' | 'Either'
}

export default function GoalSetter({
  onUpdate,
}: {
  onUpdate: (g: Goal) => void
}) {
  const [goal, setGoal] = useState<Goal>({
    goalText: '',
    weeklyFocus: 'balanced',
    longRideDay: 'Sat',
  })

  // hydrate from localStorage (optional)
  useEffect(() => {
    const raw = localStorage.getItem('grava.goal')
    if (raw) {
      try { setGoal(JSON.parse(raw)) } catch {}
    }
  }, [])

  // save to localStorage (optional)
  useEffect(() => {
    localStorage.setItem('grava.goal', JSON.stringify(goal))
  }, [goal])

  return (
    <section className="rounded-2xl border border-stone-200/60 dark:border-stone-800/70 p-5 bg-white/60 dark:bg-stone-950/40 backdrop-blur space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Training Goal</h3>
        <button
          onClick={() => onUpdate(goal)}
          className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-sm hover:bg-amber-700"
        >
          Update AI Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <label className="text-xs text-stone-500">Describe your goal</label>
          <textarea
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2 text-sm"
            rows={3}
            placeholder="e.g., Build to Rad Dirt Fest 110mi in October; prioritize climbing & durability; avoid hard Tuesdays."
            value={goal.goalText}
            onChange={(e) => setGoal(g => ({ ...g, goalText: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-xs text-stone-500">Event date (optional)</label>
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2 text-sm"
            value={goal.eventDate || ''}
            onChange={(e) => setGoal(g => ({ ...g, eventDate: e.target.value || undefined }))}
          />
        </div>

        <div>
          <label className="text-xs text-stone-500">Weekly focus</label>
          <select
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2 text-sm"
            value={goal.weeklyFocus}
            onChange={(e) => setGoal(g => ({ ...g, weeklyFocus: e.target.value as Goal['weeklyFocus'] }))}
          >
            <option value="balanced">Balanced</option>
            <option value="endurance">Endurance</option>
            <option value="climbing">Climbing</option>
            <option value="speed">Speed</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-stone-500">Preferred long ride day</label>
          <select
            className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2 text-sm"
            value={goal.longRideDay}
            onChange={(e) => setGoal(g => ({ ...g, longRideDay: e.target.value as Goal['longRideDay'] }))}
          >
            <option>Sat</option>
            <option>Sun</option>
            <option>Either</option>
          </select>
        </div>
      </div>
    </section>
  )
}
