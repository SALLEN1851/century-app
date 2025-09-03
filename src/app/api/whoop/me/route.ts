import { auth } from "@/auth";
import { ensureWhoopAccessToken } from "@/server/whoopAuth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const token = await ensureWhoopAccessToken(session.user.id);

  // 1) Basic profile (needs read:profile)
  const r1 = await fetch("https://api.prod.whoop.com/developer/v2/user/profile/basic", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const profile = await r1.json();

  // 2) Latest cycles page (needs read:cycles)
  const r2 = await fetch("https://api.prod.whoop.com/developer/v2/cycle?limit=5", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const cycles = await r2.json();

  return Response.json({ profile, cycles });
}
