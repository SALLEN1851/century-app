// src/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";

// IMPORTANT: no top-level bcrypt import; do it dynamically in authorize()

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Node-only pieces are fine here:
  adapter: PrismaAdapter(prisma),
  // You can use "database" or "jwt" here. If you want DB sessions, keep:
  // session: { strategy: "database" },
  // To simplify, "jwt" works great and avoids DB lookups for sessions:
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = (creds?.email || "").toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        // dynamic import keeps Edge bundle clean
        const { compare } = await import("bcrypt");
        const ok = await compare(String(creds?.password), user.passwordHash);
        return ok ? user : null;
      },
    }),
    // Enable when ready:
    // Google({ clientId: process.env.GOOGLE_ID!, clientSecret: process.env.GOOGLE_SECRET! }),
    // WhoopProvider(), // if you added it
  ],

  callbacks: {
    async session({ session, token }) {
      // enrich session with rider fields
      if (session.user && token?.sub) {
        const u = await prisma.user.findUnique({ where: { id: token.sub } });
        if (u) {
          (session.user as any).id = u.id;
          (session.user as any).unitSystem = (u as any).unitSystem ?? "imperial";
          (session.user as any).ftp = (u as any).ftp ?? null;
          (session.user as any).riderType = (u as any).riderType ?? null;
          (session.user as any).weightLbs = (u as any).weightLbs ?? null;
        }
      }
      return session;
    },
  },

  pages: { signIn: "/signin" },
});
