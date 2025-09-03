'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [whoopData, setWhoopData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'authenticated') fetchWhoopData();
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
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading') return <div>Loading session…</div>;
  if (status === 'unauthenticated') return <div>Please sign in to view your WHOOP data</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">WHOOP Dashboard</h1>

      <button
        onClick={fetchWhoopData}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? 'Refreshing…' : 'Refresh Data'}
      </button>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded">Error: {error}</div>}

      {whoopData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Latest Cycles" data={whoopData.cycles} />
          <Card title="Recovery" data={whoopData.recovery} />
          <Card title="Sleep" data={whoopData.sleep} />
          <Card title="Workouts" data={whoopData.workouts} />
          <Card title="Health" data={whoopData.health} />
        </div>
      )}
    </div>
  );
}

function Card({ title, data }) {
  return (
    <div className="bg-black p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <pre className="text-sm overflow-auto max-h-64">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
