import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.workspaceId = user.workspaceId;
      return token;
    },
    session({ session, token }) {
      if (typeof token.workspaceId === "string") session.user.workspaceId = token.workspaceId;
      return session;
    },
    authorized({ auth, request }) {
      const isPublic =
        request.nextUrl.pathname === "/" ||
        request.nextUrl.pathname.startsWith("/login") ||
        request.nextUrl.pathname.startsWith("/sign") ||
        request.nextUrl.pathname.startsWith("/api/contracts") ||
        request.nextUrl.pathname.startsWith("/api/recall") ||
        request.nextUrl.pathname.startsWith("/api/cron") ||
        request.nextUrl.pathname.startsWith("/terms") ||
        request.nextUrl.pathname.startsWith("/privacy");
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
