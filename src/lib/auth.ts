import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { buildDefaultTemplates } from "@/lib/default-templates";
import { attachOnboardingProfile } from "@/lib/onboarding";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const allowed = await checkRateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
        if (!allowed) {
          await logAudit({ actorEmail: email, action: "login.rate_limited" });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          await logAudit({ actorEmail: email, action: "login.failure", metadata: { reason: "no_such_account" } });
          return null;
        }

        const valid = verifyPassword(password, user.passwordHash);
        if (!valid) {
          await logAudit({ workspaceId: user.workspaceId, actorEmail: email, action: "login.failure", metadata: { reason: "wrong_password" } });
          return null;
        }

        await logAudit({ workspaceId: user.workspaceId, actorEmail: email, action: "login.success", metadata: { provider: "credentials" } });
        return { id: user.id, name: user.name, email: user.email, workspaceId: user.workspaceId };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Runs on every request that touches a session, but `account`/`profile` are
    // only present right after a provider's sign-in exchange — everywhere else
    // this is just decoding the existing token, so the DB lookup below only
    // ever fires on an actual Google sign-in, never on routine session reads.
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      const { account, profile } = params;

      if (account?.provider === "google" && !token.workspaceId && profile?.email) {
        const email = profile.email as string;
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          const name = (profile.name as string | undefined) ?? email;
          const workspace = await prisma.workspace.create({ data: { name: `${name}'s Workspace` } });
          user = await prisma.user.create({
            data: { workspaceId: workspace.id, name, email, passwordHash: null, emailVerifiedAt: new Date() },
          });
          const templates = buildDefaultTemplates(workspace.name);
          await prisma.contractTemplate.createMany({
            data: templates.map((t) => ({ ...t, workspaceId: workspace.id })),
          });
          await attachOnboardingProfile(workspace.id);
          await logAudit({ workspaceId: workspace.id, actorEmail: email, action: "workspace.created", metadata: { provider: "google" } });
        } else if (!user.emailVerifiedAt) {
          // An invited teammate has no password, so Google is their only way
          // in — every sign-in already re-confirms the address with Google,
          // so there's no separate "click a link" step for them to do.
          user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        }

        await logAudit({ workspaceId: user.workspaceId, actorEmail: email, action: "login.success", metadata: { provider: "google" } });
        token.workspaceId = user.workspaceId;
      }

      return token;
    },
  },
});
