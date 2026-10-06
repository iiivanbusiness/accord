"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

// Also finishes a teammate invite (joining): the same one-time link, plus
// their name, and the invite email they opened proves the address.
export async function resetPassword(token: string, joining: boolean, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const back = (message: string) => `/reset-password/${token}?${joining ? "invite=1&" : ""}error=${encodeURIComponent(message)}`;
  if (joining && !name) redirect(back("Add your name."));
  if (password.length < 8) redirect(back("Password must be at least 8 characters."));

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    redirect(back(joining ? "This invite link was already used or has expired. Use Forgot password on the sign-in page, or ask for a new invite." : "This reset link is invalid or has expired. Request a new one."));
  }

  const current = await prisma.user.findUniqueOrThrow({ where: { id: resetToken.userId }, select: { emailVerifiedAt: true } });
  const user = await prisma.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash: hashPassword(password), ...(joining ? { name, emailVerifiedAt: current.emailVerifiedAt ?? new Date() } : {}) },
  });
  await prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } });
  await logAudit({ workspaceId: user.workspaceId, actorEmail: user.email, action: joining ? "teammate.joined" : "password.reset" });

  redirect(joining ? "/login?joined=1" : "/login?reset=1");
}
