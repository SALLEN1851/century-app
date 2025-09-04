// app/api/coach/week/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

const GoalSchema = z.object({
  goalText: z.string().optional(),
  eventDate: z.string().optional(),
  weeklyFocus: z.enum(['endurance','climbing','speed','balanced']).optional(),
  longRideDay: z.enum(['Sat','Sun','Either']).optional(),
}).partial()

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parse = GoalSchema.safeParse(body?.goal || body)
  const goal = parse.success ? parse.data : {}

  const week = await buildWeekPlan({ goal })
  return NextResponse.json({ week })
}

// Replace with LLM; stub that leans on weeklyFocus & longRideDay
async function buildWeekPlan({ goal }: { goal: any }) {
  const focus = goal?.weeklyFocus || 'balanced'
  const longDay = goal?.longRideDay || 'Sat'
  const base = focus === 'climbing' ? 55 : focus === 'endurance' ? 60 : focus === 'speed' ? 45 : 50

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weights: Record<string, number> = {
    Mon: 0.10, Tue: 0.18, Wed: 0.14, Thu: 0.18, Fri: 0.10, Sat: longDay === 'Sun' ? 0.14 : 0.24, Sun: longDay === 'Sun' ? 0.26 : 0.06,
  }

  return days.map((d) => {
    let miles = Math.round(base * weights[d] * 2) / 2
    let tone: 'easy'|'moderate'|'hard'|'rest' = 'moderate'
    if (d === 'Mon') tone = 'easy'
    if (d === longDay) tone = 'hard'
    if (d === 'Fri') tone = 'easy'
    if (focus === 'speed' && (d === 'Tue' || d === 'Thu')) tone = 'hard'
    if (focus === 'climbing' && (d === 'Wed')) tone = 'hard'

    const elev = Math.round(miles * (focus === 'climbing' ? 110 : 80))
    const note = goal?.goalText
      ? `Goal-aware: ${goal.goalText}`
      : (tone === 'hard' ? 'Quality session; fuel 60–90g/h.' : 'Steady aerobic.')

    return { day: d, miles, elev, tone, note }
  })
}
