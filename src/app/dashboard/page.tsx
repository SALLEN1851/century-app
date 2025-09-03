'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import CoachCard from '@/components/CoachCard';

// ---------- brand helpers ----------
const fmt = (n: any, f = 0) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(f));
const lastOf = (arr: any[]) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);

// Veloterra palette tokens (Tailwind classes)
// sand/stone/sage/ember/charcoal
const tone = {
  card: 'bg-stone-50/80 border-stone-200 dark:bg-stone-900/70 dark:border-stone-800',
  soft: 'bg-stone-100/70 dark:bg-stone-900/60',
  textMuted: 'text-stone-500',
  textBody: 'text-stone-800 dark:text-stone-100',
  ring: 'focus:outline-none focus:ring-2 focus:ring-amber-400/40',
  btnBorder: 'border-stone-300 dark:border-stone-700',
  btnHover: 'hover:bg-stone-100 dark:hover:bg-stone-800',
  primary: 'bg-amber-700 text-stone-50 hover:bg-amber-800',
  primaryDark: 'dark:bg-amber-400 dark:text-stone-950 dark:hover:bg-amber-300',
};

// ---------- light-weight UI atoms (pure Tailwind) ----------
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border ${tone.card} backdrop-blur p-5 shadow-sm`}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border ${tone.card} p-4`}>
      <div className={`text-[11px] uppercase tracking-wide ${tone.textMuted} mb-1`}>{label}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      {sub && <div className={`text-xs ${tone.textMuted} mt-1`}>{sub}</div>}
    </div>
  );
}

function Pill({ tone: t = 'clay', children }: { tone?: 'clay' | 'sage' | 'ember' | 'sky'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    clay: 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    sage: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    ember: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tones[t]}`}>{children}</span>;
}

function KVP({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className={`${tone.textMuted}`}>{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

// ---------- Chat widget ----------
function AskCoach() {
  const [q, setQ] = useState('How should I fuel a 3.5h Z2 ride in cold weather?');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setA('');
    try {
      const r = await fetch('/api/coach/chat', { method: 'POST', body: JSON.stringify({ question: q }) });
      const j = await r.json();
      setA(j.reply || 'No reply.');
    } catch {
      setA('Chat error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Ask the Coach"
      action={
        <button
          onClick={ask}
          disabled={busy}
          className={`rounded-lg border ${tone.btnBorder} px-3 py-1.5 text-sm ${tone.btnHover} disabled:opacity-60`}
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      }
    >
      <div className="space-y-3">
        <input
          className={`w-full rounded-md border ${tone.btnBorder} ${tone.soft} px-3 py-2 text-sm ${tone.ring}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about training, fueling, recovery…"
        />
        {!!a && <div className="text-sm whitespace-pre-wrap leading-relaxed">{a}</div>}
      </div>
    </Section>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [whoopData, setWhoopData] = useState<any>(null);
  const [serverPlan, setServerPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch AI plan
  useEffect(() => {
    (async () => {
      setPlanLoading(true);
      try {
        const r = await fetch('/api/coach', { cache: 'no-store' });
        const j = await r.json();
        setServerPlan(j);
      } catch {}
      setPlanLoading(false);
    })();
  }, []);

  // Fetch WHOOP data when authed
  useEffect(() => {
    if (status === 'authenticated') void fetchWhoopData();
  }, [status]);

  async function fetchWhoopData() {
    setLoading(true);
    setError(null);
    try {
      const [cyclesRes, recoveryRes, sleepRes, workoutsRes, healthRes] = await Promise.all([
        fetch('/api/whoop/cycles'),
        fetch('/api/whoop/recovery'),
        fetch('/api/whoop/sleep'),
        fetch('/api/whoop/workouts'),
        fetch('/api/whoop/health'),
      ]);
      for (const r of [cyclesRes, recoveryRes, sleepRes, workoutsRes, healthRes]) {
        if (!r.ok) throw new Error(`Fetch failed: ${new URL(r.url).pathname} (${r.status})`);
      }
      const [cycles, recovery, sleep, workouts, health] = await Promise.all([
        cyclesRes.json(),
        recoveryRes.json(),
        sleepRes.json(),
        workoutsRes.json(),
        healthRes.json(),
      ]);
      setWhoopData({ cycles, recovery, sleep, workouts, health });
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Derive quick stats safely
  const stats = useMemo(() => {
    const rec = whoopData?.recovery?.records || [];
    const slp = whoopData?.sleep?.records || [];
    const cyc = whoopData?.cycles?.records || [];

    const lastRec = lastOf(rec);
    const recoveryScore = lastRec?.score?.recovery_score ?? null;
    const rhr = lastRec?.score?.resting_heart_rate ?? null;

    const lastSleep = lastOf(slp);
    const sleepPct = lastSleep?.score?.sleep_performance_percentage ?? null;
    const sleepHrs =
      typeof sleepPct === 'number'
        ? 8 * (sleepPct / 100)
        : (lastSleep?.score?.stage_summary?.total_in_bed_time_milli ?? 0) / 1000 / 3600 || null;

    // strain (max per day)
    let strainToday: number | null = null;
    if (Array.isArray(cyc) && cyc.length) {
      const map = new Map<string, number>();
      for (const c of cyc) {
        const d = new Date(c.start ?? '').toISOString().slice(0, 10);
        const s = c?.score?.strain ?? 0;
        map.set(d, Math.max(map.get(d) ?? 0, s));
      }
      const todayKey = new Date().toISOString().slice(0, 10);
      strainToday = map.get(todayKey) ?? lastOf([...map.values()]);
    }

    return { recoveryScore, rhr, sleepHrs, strainToday };
  }, [whoopData]);

  if (status === 'loading') return <div className="p-8 text-sm">Loading session…</div>;
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">Please sign in</h1>
          <p className={`${tone.textMuted}`}>You need to sign in to view your WHOOP dashboard.</p>
        </div>
      </div>
    );
  }

  const plan = serverPlan?.plan;
  const fueling = plan?.fueling;

  return (
    <div
      className={`
        min-h-screen ${tone.textBody}
        bg-gradient-to-b from-stone-100 via-stone-50 to-stone-100
        dark:from-stone-950 dark:via-stone-900 dark:to-stone-950
      `}
    >
      <header
        className={`
          sticky top-0 z-10 border-b bg-stone-50/70 dark:bg-stone-950/70 backdrop-blur
          border-stone-200/70 dark:border-stone-800/70
        `}
      >
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              <span className="mr-2 inline-block rounded-md bg-amber-600 text-stone-50 px-2 py-0.5">VeloTerra</span>
              Coach
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
                setPlanLoading(true);
                try {
                  const r = await fetch('/api/coach?force=1', { cache: 'no-store' });
                  const j = await r.json();
                  setServerPlan(j);
                } finally {
                  setPlanLoading(false);
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

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Recovery" value={`${fmt(stats.recoveryScore)}`} sub="/100" />
          <Stat label="Sleep (last night)" value={`${fmt(stats.sleepHrs, 1)} h`} sub="target ≈ 8h" />
          <Stat label="Strain (today)" value={`${fmt(stats.strainToday, 1)}`} sub="WHOOP scale" />
          <Stat label="Resting HR" value={`${fmt(stats.rhr)} bpm`} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Coach card + AI plan */}
          <div className="lg:col-span-2 space-y-6">
            <Section title="Today’s Coach">
              <CoachCard />
            </Section>

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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Workout */}
                  <div className={`md:col-span-2 rounded-xl border ${tone.card} p-4`}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold">{plan.workout?.label ?? '—'}</h4>
                      <Pill tone="clay">{plan.workout?.duration_min ? `${plan.workout.duration_min} min` : '—'}</Pill>
                    </div>
                    <div className={`text-sm ${tone.textMuted} space-y-2`}>
                      <KVP k="Zones" v={plan.workout?.zones ?? '—'} />
                      {plan.workout?.intervals ? <KVP k="Intervals" v={plan.workout.intervals} /> : null}
                      {plan.workout?.notes ? (
                        <div className="pt-2 text-stone-700 dark:text-stone-300">{plan.workout.notes}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Fueling */}
                  <div className={`rounded-xl border ${tone.card} p-4`}>
                    <h4 className="font-semibold mb-2">Fueling</h4>
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
                      <p className={`mt-3 text-xs ${tone.textMuted} leading-relaxed`}>{serverPlan.plan.rationale}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`text-sm ${tone.textMuted}`}>{planLoading ? 'Generating plan…' : 'No plan yet.'}</div>
              )}
            </Section>
          </div>

          {/* Right column: Chat only (raw datasets removed) */}
          <div className="space-y-6">
            <AskCoach />
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 p-3">
                Error: {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
