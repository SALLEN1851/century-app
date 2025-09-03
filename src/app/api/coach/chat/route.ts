import { NextResponse, NextRequest } from "next/server";
import { openai } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json().catch(() => ({ question: "" }));

    // Absolute base + cookie forwarding so /api/whoop/* stays authed
    const base = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") ?? "";

    // Try to fetch a tiny WHOOP summary (optional; skip if unauthorized)
    let recoveryScore: number | null = null;
    try {
      const res = await fetch(`${base}/api/whoop/recovery`, {
        cache: "no-store",
        headers: { cookie: cookieHeader },
      });
      if (res.ok) {
        const rec = await res.json();
        const records = Array.isArray(rec?.records) ? rec.records : [];
        const last = records.length ? records[records.length - 1] : null;
        recoveryScore = last?.score?.recovery_score ?? null;
      }
      // if !res.ok, just proceed without WHOOP context
    } catch {
      // swallow WHOOP errors for chat
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are CenturyCoach—concise, practical training/fueling guidance. Not medical advice. Cite user's metrics when relevant.",
        },
        {
          role: "user",
          content: `Recovery today: ${recoveryScore ?? "unknown"}.\nQuestion: ${question}`,
        },
      ],
    });

    return NextResponse.json({
      reply: completion.choices[0]?.message?.content ?? "",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "chat-failed" },
      { status: 500 }
    );
  }
}
