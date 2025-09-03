import { auth } from "@/auth";
import { prisma } from "@/server/prisma";
import { ensureWhoopAccessToken } from "@/server/whoopAuth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  // Get a reliable userId for both "jwt" and "database" session strategies
  let userId: string | null = (session.user as any).id ?? null;
  if (!userId && session.user.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = u?.id ?? null;
  }
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "10"; // WHOOP default is 10, max 25
  const start = searchParams.get("start"); // ISO string
  const end   = searchParams.get("end");   // ISO string

  const qs = new URLSearchParams({ limit });
  if (start) qs.set("start", start);
  if (end)   qs.set("end", end);

  const token = await ensureWhoopAccessToken(userId);

  const res = await fetch(
    `https://api.prod.whoop.com/developer/v2/recovery?${qs.toString()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  const body = await res.text();
  if (!res.ok) return new Response(`WHOOP error ${res.status}: ${body}`, { status: 502 });
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}
