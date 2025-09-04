// src/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcrypt";
// src/app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs"; // needed since we use Prisma/bcrypt
import { handlers } from "@/auth";

export const { GET, POST } = handlers;

// Optional: WHOOP custom OAuth provider (uncomment to enable)
function WhoopProvider(): any {
  return {
    id: "whoop",
    name: "WHOOP",
    type: "oauth",
    authorization: {
      url: "https://api.prod.whoop.com/oauth/oauth2/auth",
      params: {
        scope:
          "offline read:profile read:cycles read:recovery read:sleep read:workout",
      },
    },
    token: "https://api.prod.whoop.com/oauth/oauth2/token",
    userinfo: {
      url: "https://api.prod.whoop.com/developer/v2/user/profile/basic",
      async request({ tokens }) {
        const r = await fetch(
          "https://api.prod.whoop.com/developer/v2/user/profile/basic",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (!r.ok) throw new Error("WHOOP userinfo failed");
        return r.json();
      },
    },
    profile(p: any) {
      return {
        id: String(p.user_id),
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
        email: p.email || null,
        image: null,
      };
    },
    clientId: process.env.AUTH_WHOOP_ID,
    clientSecret: process.env.AUTH_WHOOP_SECRET,
    checks: ["pkce", "state"],
  };
}


export const { auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = (creds?.email || "").toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(String(creds?.password), user.passwordHash);
        return ok ? user : null;
      },
    }),

    // OAuth (enable as needed)
    // Google({ clientId: process.env.GOOGLE_ID!, clientSecret: process.env.GOOGLE_SECRET! }),
    WhoopProvider(),
  ],

  // Put rider profile fields on the session for easy client use
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).unitSystem = (user as any).unitSystem ?? "imperial";
        (session.user as any).ftp = (user as any).ftp ?? null;
        (session.user as any).riderType = (user as any).riderType ?? null;
        (session.user as any).weightLbs = (user as any).weightLbs ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/signin",
  },
});
