import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isPublic =
        request.nextUrl.pathname.startsWith("/login") ||
        request.nextUrl.pathname.startsWith("/sign") ||
        request.nextUrl.pathname.startsWith("/api/contracts");
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
