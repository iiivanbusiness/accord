"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

export async function resetPassword(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect(`/reset-password/${token}?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    redirect(`/reset-password/${token}?error=${encodeURIComponent("This reset link is invalid or has expired — request a new one.")}`);
  }

  const user = await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash: hashPassword(password) } });
  await prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } });
  await logAudit({ workspaceId: user.workspaceId, actorEmail: user.email, action: "password.reset" });

  redirect("/login?reset=1");
}
