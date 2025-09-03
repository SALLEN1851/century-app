import { prisma } from "@/server/prisma";

export async function ensureWhoopAccessToken(userId: string) {
  const acct = await prisma.account.findFirst({ where: { userId, provider: "whoop" } });
  if (!acct?.refresh_token) throw new Error("No WHOOP account linked.");

  const now = Math.floor(Date.now() / 1000);
  if (acct.expires_at && acct.expires_at > now + 60) return acct.access_token!;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: acct.refresh_token,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: "offline",
  });

  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`WHOOP refresh failed: ${res.status} ${txt}`);
  }
  const data = await res.json();

  await prisma.account.update({
    where: { id: acct.id },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token, // WHOOP rotates – keep newest
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      token_type: data.token_type,
      scope: data.scope,
    },
  });

  return data.access_token as string;
}
