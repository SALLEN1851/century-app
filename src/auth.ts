import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: "whoop",
      name: "WHOOP",
      type: "oauth",
      clientId: process.env.WHOOP_CLIENT_ID || "7f9247a0-74b4-4017-8a91-a6e264904c79",
      clientSecret: process.env.WHOOP_CLIENT_SECRET || "57cd9fdd7dc99efb58ce292799985a69e6e9c81dc678634b963bfd659fe17d6b",
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      checks: ["state"], // Force use of state instead of PKCE
      authorization: {
        url: "https://api.prod.whoop.com/oauth/oauth2/auth",
        params: {
          scope: "offline read:profile read:cycles read:recovery read:sleep read:workout",
        },
      },
      token: {
        url: "https://api.prod.whoop.com/oauth/oauth2/token",
      },
      userinfo: {
        url: "https://api.prod.whoop.com/developer/v2/user/profile/basic",
      },
      profile(profile: any) {
        return {
          id: profile.user_id.toString(),
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          image: null,
        };
      },
    },
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session({ session, token }: any) {
      if (session?.user && token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  debug: true,
});