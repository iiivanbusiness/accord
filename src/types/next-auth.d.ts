import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    workspaceId: string;
  }
  interface Session {
    user: {
      workspaceId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    workspaceId?: string;
  }
}
