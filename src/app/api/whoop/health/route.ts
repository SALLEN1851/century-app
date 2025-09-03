import { auth } from "@/auth";
import { prisma } from "@/server/prisma";
import { ensureWhoopAccessToken } from "@/server/whoopAuth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let userId: string | null = (session.user as any).id ?? null;
  if (!userId && session.user.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = u?.id ?? null;
  }
  if (!userId) return Response.json({ ok: false, reason: "no-user-id" }, { status: 401 });

  try {
    const token = await ensureWhoopAccessToken(userId);
    const r = await fetch("https://api.prod.whoop.com/developer/v2/user/profile/basic", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    return Response.json({ ok: r.ok, status: r.status });
  } catch (e:any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
