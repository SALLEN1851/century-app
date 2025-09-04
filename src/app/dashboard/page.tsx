'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import CoachCard from '@/components/CoachCard'
import GoalSetter from '@/components/GoalSetter'

import { Dialog, DialogBackdrop, DialogPanel, TransitionChild } from '@headlessui/react'
import {
  Bars3Icon,
  CalendarIcon,
  ChartPieIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  HomeIcon,
  UsersIcon,
  XMarkIcon,
  MapIcon,
} from '@heroicons/react/24/outline'

/* ----------------- Nav data ----------------- */
const navigation = [
  { name: 'Dashboard', href: '#', icon: HomeIcon, current: true },
  { name: 'Routes', href: '#', icon: UsersIcon, current: false },
  { name: 'My Week',  href: '/week',      icon: CalendarIcon }, 
  { name: 'Events', href: '#', icon: CalendarIcon, current: false },
  { name: 'Marketplace', href: '#', icon: DocumentDuplicateIcon, current: false },
  { name: 'GravaFlow', href: '/gravaflow', icon: MapIcon, current: false },
  { name: 'Settings', href: '#', icon: ChartPieIcon, current: false },
]
const teams = [
  { id: 1, name: 'Crew', href: '#', initial: 'C', current: false },
  { id: 2, name: 'Routes', href: '#', initial: 'R', current: false },
  { id: 3, name: 'Gear', href: '#', initial: 'G', current: false },
]



function classNames(...classes: (string | boolean | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function SidebarNav() {
  const pathname = usePathname()

  return (
    <ul role="list" className="-mx-2 space-y-1">
      {navigation.map((item) => {
        const current = pathname === item.href
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              className={[
                current
                  ? 'bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
              ].join(' ')}
            >
              <item.icon
                aria-hidden="true"
                className={[
                  current ? 'text-indigo-600 dark:text-white'
                          : 'text-gray-400 group-hover:text-indigo-600 dark:text-gray-500 dark:group-hover:text-white',
                  'size-6 shrink-0',
                ].join(' ')}
              />
              {item.name}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/* ----------------- Brand tokens ----------------- */
const tone = {
  // cards & surfaces
  card:
    'bg-grava-sand/60 border-grava-stone/20 backdrop-blur',
  soft: 'bg-grava-sand/60 dark:bg-grava-charcoal/50',

  // text
  textMuted: 'text-grava-taupe',
  textBody: 'text-grava-charcoal dark:text-white',

  // focus ring
  ring: 'focus:outline-none focus:ring-2 focus:ring-grava-ember/40',

  // buttons
  btnBorder: 'border-grava-stone/30 dark:border-white/10',
  btnHover: 'hover:bg-grava-sand/70 dark:hover:bg-white/5',

  // primary CTA
  primary: 'bg-grava-ember text-white hover:bg-[#ea6c0f]',
  primaryDark: 'dark:bg-grava-amber dark:text-grava-charcoal dark:hover:bg-[#ffc56f]',
}

/* ----------------- UI atoms ----------------- */
const fmt = (n: any, f = 0) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(f))
const lastOf = (arr: any[]) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null)

function Section({ title, action, children }: any) {
  return (
    <section className={`rounded-2xl border ${tone.card} p-5 shadow-soft`}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, sub }: any) {
  return (
    <div className={`rounded-xl border ${tone.card} p-4`}>
      <div className={`mb-1 text-[11px] uppercase tracking-wide ${tone.textMuted}`}>{label}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      {sub && <div className={`mt-1 text-xs ${tone.textMuted}`}>{sub}</div>}
    </div>
  )
}

function Pill({ tone: t = 'clay', children }: any) {
  const tones: Record<string, string> = {
    clay: 'bg-grava-sand text-grava-charcoal dark:bg-white/10 dark:text-white',
    sage: 'bg-grava-sage/15 text-grava-sage dark:bg-grava-sage/20 dark:text-grava-sage',
    ember: 'bg-grava-ember/15 text-grava-ember dark:bg-grava-ember/25 dark:text-grava-amber',
    sky: 'bg-grava-sky/15 text-grava-steel dark:bg-grava-sky/20 dark:text-grava-sky',
    danger: 'bg-grava-crimson/10 text-grava-crimson',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[t]}`}>{children}</span>
}

function KVP({ k, v }: any) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className={`${tone.textMuted}`}>{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  )
}

/* ----------------- AskCoach ----------------- */
function AskCoach() {
  const [q, setQ] = useState('How should I fuel a 3.5h Z2 ride in cold weather?')
  const [a, setA] = useState('')
  const [busy, setBusy] = useState(false)

  async function ask() {
    setBusy(true)
    setA('')
    try {
      const r = await fetch('/api/coach/chat', { method: 'POST', body: JSON.stringify({ question: q }) })
      const j = await r.json()
      setA(j.reply || 'No reply.')
    } catch {
      setA('Chat error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="AI Chat Companion"
      action={
        <button
          onClick={ask}
          disabled={busy}
          className={`rounded-lg border ${tone.btnBorder} px-3 py-1.5 text-sm ${tone.btnHover} disabled:opacity-60 ${tone.ring}`}
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      }
    >
      <div className="space-y-3">
        <input
          className={`w-full rounded-md border ${tone.btnBorder} ${tone.soft} px-3 py-2 text-sm ${tone.ring} placeholder:opacity-70`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about training, fueling, recovery…"
        />
        {!!a && <div className="whitespace-pre-wrap text-sm leading-relaxed">{a}</div>}
      </div>
    </Section>
  )
}

/* ----------------- Main Dashboard ----------------- */
export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session, status } = useSession()

  const [goal, setGoal] = useState<any>(null)
  const [whoopData, setWhoopData] = useState<any>(null)
  const [serverPlan, setServerPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setPlanLoading(true)
      try {
        const r = await fetch('/api/coach', { cache: 'no-store' })
        const j = await r.json()
        setServerPlan(j)
      } catch {}
      setPlanLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (status === 'authenticated') void fetchWhoopData()
  }, [status])

  async function fetchWhoopData() {
    setLoading(true)
    setError(null)
    try {
      const [cyclesRes, recoveryRes, sleepRes, workoutsRes, healthRes] = await Promise.all([
        fetch('/api/whoop/cycles'),
        fetch('/api/whoop/recovery'),
        fetch('/api/whoop/sleep'),
        fetch('/api/whoop/workouts'),
        fetch('/api/whoop/health'),
      ])
      for (const r of [cyclesRes, recoveryRes, sleepRes, workoutsRes, healthRes]) {
        if (!r.ok) throw new Error(`Fetch failed: ${new URL(r.url).pathname} (${r.status})`)
      }
      const [cycles, recovery, sleep, workouts, health] = await Promise.all([
        cyclesRes.json(),
        recoveryRes.json(),
        sleepRes.json(),
        workoutsRes.json(),
        healthRes.json(),
      ])
      setWhoopData({ cycles, recovery, sleep, workouts, health })
    } catch (e: any) {
      setError(e?.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const rec = whoopData?.recovery?.records || []
    const slp = whoopData?.sleep?.records || []
    const cyc = whoopData?.cycles?.records || []

    const lastRec = lastOf(rec)
    const recoveryScore = lastRec?.score?.recovery_score ?? null
    const rhr = lastRec?.score?.resting_heart_rate ?? null

    const lastSleep = lastOf(slp)
    const sleepPct = lastSleep?.score?.sleep_performance_percentage ?? null
    const sleepHrs =
      typeof sleepPct === 'number'
        ? 8 * (sleepPct / 100)
        : (lastSleep?.score?.stage_summary?.total_in_bed_time_milli ?? 0) / 1000 / 3600 || null

    let strainToday: number | null = null
    if (Array.isArray(cyc) && cyc.length) {
      const map = new Map<string, number>()
      for (const c of cyc) {
        const d = new Date(c.start ?? '').toISOString().slice(0, 10)
        const s = c?.score?.strain ?? 0
        map.set(d, Math.max(map.get(d) ?? 0, s))
      }
      const todayKey = new Date().toISOString().slice(0, 10)
      strainToday = map.get(todayKey) ?? lastOf([...map.values()] as number[])
    }

    return { recoveryScore, rhr, sleepHrs, strainToday }
  }, [whoopData])

  if (status === 'loading') return <div className="p-8 text-sm">Loading session…</div>
  if (status === 'unauthenticated')
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-bold">Please sign in</h1>
          <p className={`${tone.textMuted}`}>You need to sign in to view your WHOOP dashboard.</p>
        </div>
      </div>
    )

  const plan = serverPlan?.plan
  const fueling = plan?.fueling

  return (
    <>
      {/* Root tips:
        <html className="h-full bg-grava-sand dark:bg-grava-charcoal"><body className="h-full">
      */}
      <div className={`${tone.textBody}`}>
        {/* Mobile sidebar */}
        <Dialog open={sidebarOpen} onClose={setSidebarOpen} className="relative z-50 lg:hidden">
          <DialogBackdrop
            transition
            className="fixed inset-0 bg-grava-charcoal transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
          />
          <div className="fixed inset-0 flex">
            <DialogPanel
              transition
              className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-closed:-translate-x-full"
            >
              <TransitionChild>
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-closed:opacity-0">
                  <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5">
                    <span className="sr-only">Close sidebar</span>
                    <XMarkIcon aria-hidden="true" className="size-6 text-white" />
                  </button>
                </div>
              </TransitionChild>

              {/* Sidebar */}
              <div className="relative flex grow flex-col gap-y-5 overflow-y-auto bg-grava-charcoal px-6 pb-2 dark:bg-grava-charcoal dark:before:absolute dark:before:inset-0 dark:before:bg-black/10 dark:before:border-r dark:before:border-white/10 dark:before:pointer-events-none">
                <div className="relative flex h-16 shrink-0 items-center">
                  <div className="inline-flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-grava-ember" />
                    <span className="font-black tracking-tight">grava</span>
                  </div>
                </div>
                <nav className="relative flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-1">
                        {navigation.map((item) => (
                          <li key={item.name}>
                            <a
                              href={item.href}
                              className={classNames(
                                item.current
                                  ? 'bg-grava-amber/15 text-grava-ember dark:bg-white/5 dark:text-white'
                                  : 'text-grava-stone hover:bg-grava-amber/10 hover:text-grava-ember dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white',
                                'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                              )}
                            >
                              <item.icon
                                aria-hidden="true"
                                className={classNames(
                                  item.current
                                    ? 'text-grava-ember dark:text-white'
                                    : 'text-grava-taupe group-hover:text-grava-ember dark:text-white/50 dark:group-hover:text-white',
                                  'size-6 shrink-0',
                                )}
                              />
                              {item.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>

                    <li>
                      <div className="text-xs/6 font-semibold text-grava-taupe dark:text-white/60">My Club</div>
                      <ul role="list" className="-mx-2 mt-2 space-y-1">
                        {teams.map((team) => (
                          <li key={team.name}>
                            <a
                              href={team.href}
                              className={classNames(
                                team.current
                                  ? 'bg-grava-amber/15 text-grava-ember dark:bg-white/5 dark:text-white'
                                  : 'text-grava-stone hover:bg-grava-amber/10 hover:text-grava-ember dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white',
                                'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                              )}
                            >
                              <span
                                className={classNames(
                                  team.current
                                    ? 'border-grava-ember text-grava-ember dark:border-white/20 dark:text-white'
                                    : 'border-grava-sand/60 text-grava-taupe group-hover:border-grava-ember group-hover:text-grava-ember dark:border-white/10 dark:group-hover:border-white/20 dark:group-hover:text-white',
                                  'flex size-6 shrink-0 items-center justify-center rounded-lg border bg-white text-[0.625rem] font-medium dark:bg-white/5',
                                )}
                              >
                                {team.initial}
                              </span>
                              <span className="truncate">{team.name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>
                  </ul>
                </nav>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <div className="relative flex grow flex-col gap-y-5 overflow-y-auto border-r border-grava-stone/20 bg- px-6 dark:border-white/10 dark:bg-grava-charcoal dark:before:absolute dark:before:inset-0 dark:before:bg-black/10 dark:before:pointer-events-none">
            <div className="relative flex h-16 shrink-0 items-center">
              <div className="inline-flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-grava-ember" />
                <span className="font-black tracking-tight">GRAVA</span>
              </div>
            </div>
            <nav className="relative flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          className={classNames(
                            item.current
                              ? 'bg-grava-amber/15 text-grava-ember dark:bg-white/5 dark:text-white'
                              : 'text-grava-stone hover:bg-grava-amber/10 hover:text-grava-ember dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white',
                            'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                          )}
                        >
                          <item.icon
                            aria-hidden="true"
                            className={classNames(
                              item.current
                                ? 'text-grava-ember dark:text-white'
                                : 'text-grava-taupe group-hover:text-grava-ember dark:text-white/50 dark:group-hover:text-white',
                              'size-6 shrink-0',
                            )}
                          />
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>

                <li>
                  <div className="text-xs/6 font-semibold text-grava-taupe dark:text-white/60">My Club</div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
                    {teams.map((team) => (
                      <li key={team.name}>
                        <a
                          href={team.href}
                          className={classNames(
                            team.current
                              ? 'bg-grava-amber/15 text-grava-ember dark:bg-white/5 dark:text-white'
                              : 'text-grava-stone hover:bg-grava-amber/10 hover:text-grava-ember dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white',
                            'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                          )}
                        >
                          <span
                            className={classNames(
                              team.current
                                ? 'border-grava-ember text-grava-ember dark:border-white/20 dark:text-white'
                                : 'border-grava-sand/60 text-grava-taupe group-hover:border-grava-ember group-hover:text-grava-ember dark:border-white/10 dark:group-hover:border-white/20 dark:group-hover:text-white',
                              'flex size-6 shrink-0 items-center justify-center rounded-lg border bg-white text-[0.625rem] font-medium dark:bg-white/5',
                            )}
                          >
                            {team.initial}
                          </span>
                          <span className="truncate">{team.name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>

                <li className="-mx-6 mt-auto">
                  <a
                    href="#"
                    className="flex items-center gap-x-4 px-6 py-3 text-sm/6 font-semibold text-grava-charcoal hover:bg-grava-amber/10 dark:text-white dark:hover:bg-white/5"
                  >
                    <img
                      alt=""
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      className="size-8 rounded-full bg-grava-sand outline -outline-offset-1 outline-black/5 dark:bg-white/5 dark:outline-white/10"
                    />
                    <span className="sr-only">Your profile</span>
                    <span aria-hidden="true">Tom Cook</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 shadow-xs sm:px-6 lg:hidden dark:bg-grava-charcoal dark:shadow-none dark:before:absolute dark:before:inset-0 dark:before:border-b dark:before:border-white/10 dark:before:bg-black/10 dark:before:pointer-events-none">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="relative -m-2.5 p-2.5 text-grava-stone lg:hidden dark:text-white/70"
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>
          <div className="relative flex-1 text-sm/6 font-semibold text-grava-charcoal dark:text-white">Dashboard</div>
          <a href="#" className="relative">
            <span className="sr-only">Your profile</span>
            <img
              alt=""
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              className="size-8 rounded-full bg-grava-sand outline -outline-offset-1 outline-black/5 dark:bg-white/5 dark:outline-white/10"
            />
          </a>
        </div>

        {/* MAIN + RIGHT SIDEBAR */}
        <main className="lg:pl-72">
          <div className="xl:pr-96">
            <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
              {/* Header */}
              <header className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tight">
                      <span className="mr-2 inline-block rounded-md bg-grava-ember py-0.5 text-white">GRAVA</span>
                    </h1>
                    <p className={`text-xs ${tone.textMuted}`}>Gravel Training • Fueling • Recovery (WHOOP-integrated)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchWhoopData()}
                      disabled={loading}
                      className={`rounded-lg border ${tone.btnBorder} px-3 py-1.5 text-sm ${tone.btnHover} disabled:opacity-60 ${tone.ring}`}
                    >
                      {loading ? 'Refreshing…' : 'Refresh Data'}
                    </button>
                    <button
                      onClick={async () => {
                        setPlanLoading(true)
                        try {
                          const r = await fetch('/api/coach?force=1', { cache: 'no-store' })
                          const j = await r.json()
                          setServerPlan(j)
                        } finally {
                          setPlanLoading(false)
                        }
                      }}
                      disabled={planLoading}
                      className={`rounded-lg px-3 py-1.5 text-sm ${tone.primary} ${tone.primaryDark} disabled:opacity-60 ${tone.ring}`}
                    >
                      {planLoading ? 'Planning…' : 'Regenerate Plan'}
                    </button>
                  </div>
                </div>
              </header>

              {/* Goal setter */}
            <GoalSetter 
  onUpdate={async (g) => {
    setGoal(g) // <-- now goal is defined

    // refresh your AI plan with goal
    const r = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal: g }),
    })
    const j = await r.json()
    setServerPlan(j)

    // optionally refresh MyWeek
    await fetch('/api/coach/week', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal: g }),
    })
  }}
/>

              
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mt-6">
                <Stat label="Recovery" value={`${fmt(stats.recoveryScore)}`} sub="/100" />
                <Stat label="Sleep (last night)" value={`${fmt(stats.sleepHrs, 1)} h`} sub="target ≈ 8h" />
                <Stat label="Strain (today)" value={`${fmt(stats.strainToday, 1)}`} sub="WHOOP scale" />
                <Stat label="Resting HR" value={`${fmt(stats.rhr)} bpm`} />
              </div>



              {/* Daily Coach + AI Plan */}
              <div className="mt-6 grid grid-cols-1 gap-6">
                {goal?.goalText && (
  <p className="mt-2 text-xs text-stone-500">
    Goal: {goal.goalText} {goal.eventDate ? `• Target: ${goal.eventDate}` : ''}
  </p>
)}

                {/* Daily Coach */}
                <Section title="Today’s Coach">
                  <CoachCard />
                </Section>

                {/* AI Coach Plan */}
                <Section
                  title="AI Coach Plan"
                  action={
                    plan ? (
                      <Pill tone={plan?.flags?.includes('fallback') ? 'ember' : 'sage'}>
                        {plan?.flags?.includes('fallback') ? 'Fallback' : 'AI'}
                      </Pill>
                    ) : null
                  }
                >
                  {plan ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {/* Workout */}
                      <div className={`md:col-span-2 rounded-xl border ${tone.card} p-4`}>
                        <div className="mb-1 flex items-center justify-between">
                          <h4 className="font-semibold">{plan.workout?.label ?? '—'}</h4>
                          <Pill tone="clay">{plan.workout?.duration_min ? `${plan.workout.duration_min} min` : '—'}</Pill>
                        </div>
                        <div className={`space-y-2 text-sm ${tone.textMuted}`}>
                          <KVP k="Zones" v={plan.workout?.zones ?? '—'} />
                          {plan.workout?.intervals ? <KVP k="Intervals" v={plan.workout.intervals} /> : null}
                          {plan.workout?.notes ? (
                            <div className="pt-2 text-grava-stone dark:text-white/80">{plan.workout.notes}</div>
                          ) : null}
                        </div>
                      </div>

                      {/* Fueling */}
                      <div className={`rounded-xl border ${tone.card} p-4`}>
                        <h4 className="mb-2 font-semibold">Fueling</h4>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className={`rounded-lg ${tone.soft} p-3`}>
                            <div className={`text-[11px] ${tone.textMuted}`}>Carbs</div>
                            <div className="text-lg font-bold">{fmt(fueling?.carbs_g)} g</div>
                            <div className={`text-[10px] ${tone.textMuted}`}>≈ {fmt(fueling?.per_hour?.carbs_g)} g/h</div>
                          </div>
                          <div className={`rounded-lg ${tone.soft} p-3`}>
                            <div className={`text-[11px] ${tone.textMuted}`}>Fluids</div>
                            <div className="text-lg font-bold">{fmt(fueling?.fluids_L, 1)} L</div>
                            <div className={`text-[10px] ${tone.textMuted}`}>≈ {fmt(fueling?.per_hour?.fluids_L, 2)} L/h</div>
                          </div>
                          <div className={`rounded-lg ${tone.soft} p-3`}>
                            <div className={`text-[11px] ${tone.textMuted}`}>Sodium</div>
                            <div className="text-lg font-bold">{fmt(fueling?.sodium_mg)} mg</div>
                            <div className={`text-[10px] ${tone.textMuted}`}>≈ {fmt(fueling?.per_hour?.sodium_mg)} mg/L</div>
                          </div>
                        </div>
                        {serverPlan?.plan?.rationale && (
                          <p className={`mt-3 text-xs leading-relaxed ${tone.textMuted}`}>{serverPlan.plan.rationale}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`text-sm ${tone.textMuted}`}>{planLoading ? 'Generating plan…' : 'No plan yet.'}</div>
                  )}
                </Section>

                {error && (
                  <div className="rounded-xl border border-grava-crimson/30 bg-grava-crimson/10 p-3 text-grava-crimson">
                    Error: {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: AskCoach */}
        <aside className="fixed inset-y-0 right-0 hidden w-96 overflow-y-auto border-l border-grava-stone/20 px-4 py-6 sm:px-6 lg:px-8 xl:block dark:border-white/10">
          <AskCoach />
        </aside>
      </div>
    </>
  )
}
