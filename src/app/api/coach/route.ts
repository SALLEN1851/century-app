import { NextResponse, NextRequest } from "next/server";
import { openai } from "@/lib/ai";

type WhoopEnvelope<T = any> = { records?: T[] };

export async function GET(request: NextRequest) {
  try {
    // --- Guard: ensure key is loaded on the server ---
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on server" },
        { status: 500 }
      );
    }

    // --- Build absolute base & forward cookies so /api/whoop/* stays authed ---
    const base = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") ?? "";
    const j = async <T = any>(path: string): Promise<T> => {
      const res = await fetch(`${base}${path}`, {
        cache: "no-store",
        headers: { cookie: cookieHeader },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GET ${path} ${res.status} ${body || ""}`.trim());
      }
      return res.json();
    };

    // --- WHOOP data ---
    const [cycles, recovery, sleep]: [WhoopEnvelope, WhoopEnvelope, WhoopEnvelope] =
      await Promise.all([j("/api/whoop/cycles"), j("/api/whoop/recovery"), j("/api/whoop/sleep")]);

    // ---- Derive readiness/load metrics ----
    const byDateAsc = (a: any, b: any) =>
      Date.parse(a.created_at ?? a.start ?? "") - Date.parse(b.created_at ?? b.start ?? "");
    const last = <T extends any[]>(arr?: T) => (arr && arr.length ? arr[arr.length - 1] : null);
    const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const sd = (a: number[]) => {
      if (a.length < 2) return 0;
      const m = mean(a);
      return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
    };

    const recSorted = [...(recovery.records ?? [])].sort(byDateAsc);
    const recoveryScore = last(recSorted)?.score?.recovery_score ?? null;

    const hrvVals = recSorted
      .map(
        (r: any) =>
          r?.score?.hrv_rmssd_millis ??
          r?.score?.heart_rate_variability_rmssd_milliseconds ??
          null
      )
      .filter((n: any) => typeof n === "number");
    let hrvTrend: "up" | "down" | "flat" | "unknown" = "unknown";
    if (hrvVals.length >= 10) {
      const last7 = hrvVals.slice(-7);
      const prev7 = hrvVals.slice(-14, -7);
      const delta = mean(last7) - mean(prev7);
      hrvTrend = Math.abs(delta) < 2 ? "flat" : delta > 0 ? "up" : "down";
    }

    const sleepSorted = [...(sleep.records ?? [])].sort(byDateAsc);
    const lastSleep = last(sleepSorted);
    const sleepHours =
      typeof lastSleep?.score?.sleep_performance_percentage === "number"
        ? 8 * (lastSleep.score.sleep_performance_percentage / 100)
        : typeof lastSleep?.score?.stage_summary?.total_in_bed_time_milli === "number"
        ? lastSleep.score.stage_summary.total_in_bed_time_milli / 1000 / 3600
        : null;
    const sleepDebtHrs = Math.max(0, 8 - (sleepHours ?? 8));

    const dayMap = new Map<string, number>();
    for (const c of cycles.records ?? []) {
      const d = new Date(c.start ?? "").toISOString().slice(0, 10);
      const s = c?.score?.strain ?? 0;
      dayMap.set(d, Math.max(dayMap.get(d) ?? 0, s));
    }
    const strainSeries = [...dayMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
    const last7 = strainSeries.slice(-7);
    const last28 = strainSeries.slice(-28);
    const acute = last7.length ? +mean(last7).toFixed(2) : null;
    const chronic = last28.length ? +mean(last28).toFixed(2) : null;
    const balance = acute != null && chronic != null ? +(acute - chronic).toFixed(2) : null;
    const monotony = last7.length ? +(mean(last7) / (sd(last7) || 1)).toFixed(2) : null;

    const summary = {
      date: new Date().toISOString(),
      recoveryScore,
      hrvTrend,
      sleepDebtHrs,
      load: { acute, chronic, balance, monotony },
    };

    // ---- Ask the model (Structured Output) ----
 const schema = {
  name: "coach_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      workout: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          duration_min: { type: "number" },
          zones: { type: "string" },
          intervals: { type: "string" },
          notes: { type: "string" },
        },
        required: ["label", "duration_min", "zones", "intervals", "notes"],
      },
      fueling: {
        type: "object",
        additionalProperties: false,
        properties: {
          carbs_g: { type: "number" },
          fluids_L: { type: "number" },
          sodium_mg: { type: "number" },
          per_hour: {
            type: "object",
            additionalProperties: false,
            properties: {
              carbs_g: { type: "number" },
              fluids_L: { type: "number" },
              sodium_mg: { type: "number" },
            },
            required: ["carbs_g", "fluids_L", "sodium_mg"],
          },
        },
        required: ["carbs_g", "fluids_L", "sodium_mg", "per_hour"],
      },
      rationale: { type: "string" },
      flags: { type: "array", items: { type: "string" } },
    },
    required: ["workout", "fueling", "rationale", "flags"],
  },
} as const;


    // Use your env or fall back to a versioned model known to work well with structured outputs
    const model = process.env.OPENAI_MODEL || "gpt-4o-2024-08-06";

    const completion = await openai.chat.completions.create(
      {
        model,
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
          {
            role: "system",
            content: `You are CenturyCoach, a cycling training and fueling assistant.
Use WHOOP metrics to gate intensity:
- 80–100 recovery & HRV not down & sleep_debt < 1h & (acute - chronic) <= 2 → Intervals/Tempo.
- 60–79 → Endurance w/ short tempo optional.
- 40–59 → Recovery spin only.
- <40 → Rest/mobility.

Fueling per hour: 60–90g carbs, 0.4–0.8L fluids (more in heat), 300–1000mg sodium. Return a concise plan and brief rationale referencing inputs.`,
          },
          {
            role: "user",
            content: `WHOOP summary for today: ${JSON.stringify(summary)}. Assume moderate heat unless stated otherwise.`,
          },
        ],
      },
      { timeout: 15000 } // optional: avoid long hangs
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(raw);
    return NextResponse.json({ summary, plan: json });
  } catch (e: any) {
    // Bubble up more detail so you can see WHY it 500s
    const status = e?.status || 500;
    const detail =
      (e?.response && (await e.response.text().catch(() => ""))) ||
      e?.message ||
      String(e);

    return NextResponse.json({ error: "coach-failed", detail }, { status });
  }
}
