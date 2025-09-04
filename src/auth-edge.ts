// src/auth-edge.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Edge cannot bundle Prisma/bcrypt. We only need enough config
// for cookie/JWT verification here. Use JWT sessions.
export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    // We don’t actually log in via middleware, but NextAuth
    // requires at least one provider in v5. This placeholder
    // keeps the config minimal & Edge-safe.
    Credentials({
      name: "EdgePlaceholder",
      credentials: {},
      // NEVER called in middleware; return null
      async authorize() {
        return null;
      },
    }),
  ],
});
