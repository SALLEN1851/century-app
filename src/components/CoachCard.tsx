'use client';

import { useEffect, useMemo, useState } from 'react';

type WhoopEnvelope<T = any> = { records?: T[] };
type Cycle = {
  id: number | string;
  start?: string;
  end?: string | null;
  score?: { strain?: number };
};
type Recovery = {
  id?: number | string;
  score?: {
    recovery_score?: number;                // 0–100
    resting_heart_rate?: number;            // bpm
    hrv_rmssd_millis?: number;              // some payloads expose this
    heart_rate_variability_rmssd_milliseconds?: number;
  };
  created_at?: string;
};
type Sleep = {
  id?: number | string;
  score?: {
    sleep_performance_percentage?: number;  // 0–100
    stage_summary?: { total_in_bed_time_milli?: number };
  };
  created_at?: string;
};

type ReadinessInputs = {
  recovery: number | null;
  hrvTrend: 'up' | 'flat' | 'down' | 'unknown';
  sleepDebtHrs: number;
  acute: number | null;
  chronic: number | null;
};

type FuelPlan = {
  carbs_g: number;
  fluids_L: number;
  sodium_mg: number;
  per_hour: { carbs_g: number; fluids_L: number; sodium_mg: number };
};

export default function CoachCard() {
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [recovery, setRecovery] = useState<Recovery[]>([]);
  const [sleep, setSleep] = useState<Sleep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [heat, setHeat] = useState<'low'|'mod'|'high'>('mod');
  const [gutTrained, setGutTrained] = useState<boolean>(false);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, rRes, sRes] = await Promise.all([
        fetch('/api/whoop/cycles'),
        fetch('/api/whoop/recovery'),
        fetch('/api/whoop/sleep'),
      ]);
      const [cJson, rJson, sJson]: [WhoopEnvelope<Cycle>, WhoopEnvelope<Recovery>, WhoopEnvelope<Sleep>] =
        await Promise.all([cRes.json(), rRes.json(), sRes.json()]);
      setCycles(cJson.records ?? []);
      setRecovery(rJson.records ?? []);
      setSleep(sJson.records ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load WHOOP data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  // --- Helpers ---------------------------------------------------------------

  function byDateAsc<T extends { created_at?: string; start?: string }>(a: T, b: T) {
    const da = Date.parse(a.created_at ?? (a as any).start ?? '');
    const db = Date.parse(b.created_at ?? (b as any).start ?? '');
    return da - db;
  }

  const lastNightSleepHours = useMemo(() => {
    if (!sleep?.length) return null;
    const last = [...sleep].sort(byDateAsc).at(-1)!;
    const perf = last?.score?.sleep_performance_percentage;
    if (typeof perf === 'number') return 8 * (perf / 100);
    const milli = last?.score?.stage_summary?.total_in_bed_time_milli;
    if (typeof milli === 'number') return milli / 1000 / 3600;
    return null;
  }, [sleep]);

  const sleepDebtHrs = useMemo(() => {
    if (lastNightSleepHours == null) return 0;
    return Math.max(0, 8 - lastNightSleepHours);
  }, [lastNightSleepHours]);

  const recoveryScore = useMemo(() => {
    if (!recovery?.length) return null;
    const last = [...recovery].sort(byDateAsc).at(-1)!;
    return last?.score?.recovery_score ?? null;
  }, [recovery]);

  const hrvTrend: ReadinessInputs['hrvTrend'] = useMemo(() => {
    if (!recovery?.length || recovery.length < 10) return 'unknown';
    const items = [...recovery].sort(byDateAsc);
    // try to read HRV values from several possible keys
    const vals = items
      .map(r =>
        r?.score?.hrv_rmssd_millis ??
        r?.score?.heart_rate_variability_rmssd_milliseconds ??
        null
      )
      .filter((v): v is number => typeof v === 'number');

    if (vals.length < 10) return 'unknown';
    const last7 = vals.slice(-7);
    const prev7 = vals.slice(-14, -7);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const delta = mean(last7) - mean(prev7);
    if (Math.abs(delta) < 2) return 'flat';
    return delta > 0 ? 'up' : 'down';
  }, [recovery]);

  // Build daily strain series from cycles
  const dailyStrain = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cycles) {
      const d = new Date(c.start ?? '').toISOString().slice(0, 10);
      const s = c?.score?.strain ?? 0;
      map.set(d, Math.max(map.get(d) ?? 0, s)); // keep max per day
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => v);
  }, [cycles]);

  const load = useMemo(() => {
    const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const sd = (a: number[]) => {
      if (a.length < 2) return 0;
      const m = mean(a);
      return Math.sqrt(mean(a.map(x => (x - m) ** 2)));
    };
    const last7 = dailyStrain.slice(-7);
    const last28 = dailyStrain.slice(-28);
    const acute = last7.length ? +mean(last7).toFixed(2) : null;
    const chronic = last28.length ? +mean(last28).toFixed(2) : null;
    const balance = (acute != null && chronic != null) ? +(acute - chronic).toFixed(2) : null;
    const monotony = last7.length ? +(mean(last7) / (sd(last7) || 1)).toFixed(2) : null;
    return { acute, chronic, balance, monotony };
  }, [dailyStrain]);

  function chooseWorkout(i: ReadinessInputs) {
    // Default outputs
    let label = 'Endurance (Zone 2)';
    let durationMin = 75;
    let details = 'Keep it easy and aerobic; high cadence, smooth pedaling.';

    const tooHot = i.acute != null && i.chronic != null && i.acute - i.chronic > 2;

    if (i.recovery != null && i.recovery >= 80 && i.hrvTrend !== 'down' && i.sleepDebtHrs < 1 && !tooHot) {
      label = 'Intervals / Tempo';
      durationMin = 90;
      details = 'Example: 4×8 min @ ~FTP (or high Z3/Z4) with 4 min easy between. Long Z2 warm-up/cool-down.';
    } else if (i.recovery != null && i.recovery >= 60) {
      label = 'Endurance + 2×10 min Tempo (low Z3)';
      durationMin = 75;
      details = 'Stay mostly Z2; if feeling good add two short tempo efforts. Skip tempo if HR drifts.';
    } else if (i.recovery != null && i.recovery >= 40) {
      label = 'Recovery Spin';
      durationMin = 45;
      details = 'Very easy, high cadence. Optional mobility/foam roll.';
    } else {
      label = 'Rest / Mobility';
      durationMin = 0;
      details = 'Walk, light stretch, extra sleep. Let the system rebound.';
    }

    // Long-ride weekend heuristic: if chronic is low and today is Sat/Sun with decent recovery, extend Z2
    const day = new Date().getDay(); // 0=Sun
    if (durationMin >= 60 && (day === 0 || day === 6) && (i.recovery ?? 0) >= 60) {
      durationMin = Math.max(durationMin, 120);
      details += ' Since it’s the weekend and you’re reasonably ready, extend to 2–3h Z2 if time allows.';
    }

    return { label, durationMin, details };
  }

  function fuelPlan(hours: number, heat: 'low'|'mod'|'high', gutTrained: boolean): FuelPlan {
    if (hours <= 0) {
      return {
        carbs_g: 0, fluids_L: 0, sodium_mg: 0,
        per_hour: { carbs_g: 0, fluids_L: 0, sodium_mg: 0 }
      };
    }
    const carbsPerHr = gutTrained ? 90 : 70; // adjust as you adapt your gut
    const fluidsPerHr = heat === 'high' ? 0.8 : heat === 'mod' ? 0.6 : 0.45; // L/h
    const sodiumPerL  = heat === 'high' ? 800 : heat === 'mod' ? 600 : 400;  // mg/L

    return {
      carbs_g: Math.round(hours * carbsPerHr),
      fluids_L: +(hours * fluidsPerHr).toFixed(1),
      sodium_mg: Math.round(hours * fluidsPerHr * sodiumPerL),
      per_hour: { carbs_g: carbsPerHr, fluids_L: fluidsPerHr, sodium_mg: sodiumPerL }
    };
  }

  const inputs: ReadinessInputs = {
    recovery: recoveryScore,
    hrvTrend,
    sleepDebtHrs,
    acute: load.acute,
    chronic: load.chronic,
  };

  const plan = chooseWorkout(inputs);
  const hours = +(plan.durationMin / 60).toFixed(2);
  const fuel = fuelPlan(hours, heat, gutTrained);

  // --- UI --------------------------------------------------------------------

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 p-6 shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Today’s Coach</h3>
          <button onClick={fetchAll} className="rounded-lg px-3 py-1.5 text-sm border hover:bg-slate-50 dark:hover:bg-slate-800">Retry</button>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 p-6 shadow">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold">Today’s Coach</h3>
        <div className="flex items-center gap-2">
          <select
            value={heat}
            onChange={(e) => setHeat(e.target.value as any)}
            className="rounded-md border px-2 py-1 text-sm bg-white dark:bg-slate-900"
            aria-label="Heat level"
          >
            <option value="low">Cool</option>
            <option value="mod">Moderate</option>
            <option value="high">Hot</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={gutTrained} onChange={(e)=>setGutTrained(e.target.checked)} />
            Gut-trained
          </label>
          <button onClick={fetchAll} disabled={loading} className="rounded-lg px-3 py-1.5 text-sm border hover:bg-slate-50 dark:hover:bg-slate-800">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Readiness strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Metric label="Recovery" value={recoveryScore != null ? `${recoveryScore}` : '—'} hint="/100" />
        <Metric label="HRV Trend" value={hrvTrendEmoji(hrvTrend)} hint={hrvTrend} />
        <Metric label="Sleep Debt" value={`${sleepDebtHrs.toFixed(1)}h`} />
        <Metric label="Load (7/28)" value={`${load.acute ?? '—'} / ${load.chronic ?? '—'}`} hint={`Bal ${load.balance ?? '—'} | Mono ${load.monotony ?? '—'}`} />
      </div>

      {/* Recommendation */}
      <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold">{plan.label}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">{plan.details}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{plan.durationMin ? `${plan.durationMin} min` : 'Rest'}</div>
            {plan.durationMin > 0 && <p className="text-xs text-slate-500">Aim for mostly Z2 unless noted</p>}
          </div>
        </div>
      </div>

      {/* Fueling */}
      <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile title="Carbs" value={`${fuel.carbs_g} g`} sub={`≈ ${fuel.per_hour.carbs_g} g/h`} />
        <Tile title="Fluids" value={`${fuel.fluids_L} L`} sub={`≈ ${fuel.per_hour.fluids_L} L/h`} />
        <Tile title="Sodium" value={`${fuel.sodium_mg} mg`} sub={`≈ ${fuel.per_hour.sodium_mg} mg/L`} />
      </div>

      {/* Why / guardrails */}
      <div className="text-xs text-slate-500 leading-relaxed">
        <p className="mb-1"><strong>Why this plan:</strong> recovery {recoveryScore ?? '—'}/100, HRV trend {hrvTrend}, sleep debt {sleepDebtHrs.toFixed(1)}h, acute {load.acute ?? '—'} vs chronic {load.chronic ?? '—'} (balance {load.balance ?? '—'}).</p>
        <p>Fitness guidance only, not medical advice. If fatigue, illness, or pain persists, back off and consult a professional.</p>
      </div>
    </div>
  );
}

function Metric(props: {label: string; value: string; hint?: string}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{props.label}</div>
      <div className="text-lg font-semibold">{props.value}</div>
      {props.hint && <div className="text-xs text-slate-500">{props.hint}</div>}
    </div>
  );
}

function Tile(props: {title: string; value: string; sub?: string}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{props.title}</div>
      <div className="text-xl font-bold">{props.value}</div>
      {props.sub && <div className="text-xs text-slate-500 mt-1">{props.sub}</div>}
    </div>
  );
}

function hrvTrendEmoji(t: 'up'|'flat'|'down'|'unknown') {
  return t === 'up' ? '↗︎' : t === 'down' ? '↘︎' : t === 'flat' ? '→' : '—';
}
