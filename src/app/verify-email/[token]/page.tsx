import Link from "next/link";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const verificationToken = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

  const valid = verificationToken && !verificationToken.usedAt && verificationToken.expiresAt > new Date();

  if (valid) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: verificationToken.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.emailVerificationToken.update({ where: { id: verificationToken.id }, data: { usedAt: new Date() } }),
    ]);
  }

  return (
    <div className="sm-theme relative flex min-h-screen items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo height={24} />
        </div>
        <div className="card p-6">
          {valid ? (
            <>
              <h1 className="mb-1 text-[20px] font-medium" style={{ letterSpacing: "-0.5px" }}>Email verified</h1>
              <p className="mb-5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
                Your email is confirmed — you&apos;re all set.
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-[20px] font-medium" style={{ letterSpacing: "-0.5px" }}>Link invalid or expired</h1>
              <p className="mb-5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
                This verification link no longer works. You can request a new one from Settings once you&apos;re signed in.
              </p>
            </>
          )}
          <Link href="/dashboard" className="btn btn-primary w-full justify-center">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
