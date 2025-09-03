import { auth } from "@/auth";
import { prisma } from "@/server/prisma";
import { ensureWhoopAccessToken } from "@/server/whoopAuth";

export async function GET() {
  // v5: get session via auth()
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  // Get a userId that works for both "jwt" and "database" session strategies
  let userId = (session.user as any).id ?? null;
  if (!userId && session.user.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = u?.id ?? null;
  }
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await ensureWhoopAccessToken(userId);

  const r = await fetch("https://api.prod.whoop.com/developer/v2/cycle?limit=10", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!r.ok) {
    const text = await r.text();
    return new Response(`WHOOP error ${r.status}: ${text}`, { status: 502 });
    // (502 so it's clear the upstream failed)
  }

  const data = await r.json();
  return Response.json(data);
}
