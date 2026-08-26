"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const ip = await getClientIp();
    const [emailOk, ipOk] = await Promise.all([
      checkRateLimit(`forgot-password:email:${email}`, 3, 60 * 60 * 1000),
      checkRateLimit(`forgot-password:ip:${ip}`, 10, 60 * 60 * 1000),
    ]);

    // Rate-limited attempts still redirect to the same "check your email"
    // page as a real send — same reasoning as the user-exists check below,
    // don't let the response shape leak information.
    if (!emailOk || !ipOk) redirect("/forgot-password?sent=1");

    const user = await prisma.user.findUnique({ where: { email } });
    // Same redirect regardless of whether the email exists — don't let this
    // form be used to check who has a SealMe account.
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      });

      try {
        await sendPasswordResetEmail({
          to: email,
          resetUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password/${rawToken}`,
        });
      } catch (err) {
        console.error("Failed to send password reset email", err);
      }
    }
  }

  redirect("/forgot-password?sent=1");
}
