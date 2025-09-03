import { auth } from "@/auth";
import { prisma } from "@/server/prisma";
import { ensureWhoopAccessToken } from "@/server/whoopAuth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let userId: string | null = (session.user as any).id ?? null;
  if (!userId && session.user.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = u?.id ?? null;
  }
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams({
    limit: searchParams.get("limit") ?? "10",
  });
  if (searchParams.get("start")) qs.set("start", searchParams.get("start")!);
  if (searchParams.get("end"))   qs.set("end",   searchParams.get("end")!);
  if (searchParams.get("nextToken")) qs.set("nextToken", searchParams.get("nextToken")!);

  const token = await ensureWhoopAccessToken(userId);

  const res = await fetch(
    `https://api.prod.whoop.com/developer/v2/activity/sleep?${qs}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  const text = await res.text();
  if (!res.ok) return new Response(`WHOOP error ${res.status}: ${text}`, { status: 502 });
  return new Response(text, { status: 200, headers: { "content-type": "application/json" } });
}
