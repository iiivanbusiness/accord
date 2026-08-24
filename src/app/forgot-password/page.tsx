import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="sm-theme relative flex min-h-screen items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[360px]">
        <div className="mb-6">
          <BrandLogo height={24} />
        </div>
        <h1 className="mb-1 text-[24px] font-medium" style={{ letterSpacing: "-0.8px" }}>Reset your password</h1>
        <p className="mb-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          <Link href="/login" className="font-medium" style={{ color: "var(--accent-blue)" }}>
            Back to sign in
          </Link>
        </p>

        {sent ? (
          <div className="card p-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            If that email has a SealMe account, a reset link is on its way — check your inbox.
          </div>
        ) : (
          <form action={requestPasswordReset} className="card flex flex-col gap-3 p-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Email</span>
              <input name="email" type="email" required placeholder="you@company.com" className="input" />
            </label>
            <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
              Send reset link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
