"use client";
import { useState } from "react";

export default function WhoopTestPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    try {
      const r = await fetch("/api/whoop/me", { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const j = await r.json();
      setData(j);
    } catch (e:any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">WHOOP API Test</h1>
      <button onClick={run} className="px-4 py-2 rounded-xl bg-black text-white">Fetch /api/whoop/me</button>
      {err && <pre className="text-red-600 text-sm">{err}</pre>}
      {data && <pre className="text-xs bg-slate-100 p-3 rounded">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
