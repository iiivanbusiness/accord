import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

const ERROR_MESSAGE: Record<string, string> = {
  CredentialsSignin: "Wrong email or password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: callbackUrl || "/deals",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?error=${err.type}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
      }
      throw err;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-[360px]">
        <div
          className="mb-6 flex h-[34px] w-[34px] items-center justify-center rounded-[10px] font-display text-[15px] font-semibold"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
        >
          A
        </div>
        <h1 className="mb-1 text-[24px] font-medium" style={{ letterSpacing: "-0.8px" }}>Sign in to Accord</h1>
        <p className="mb-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>Horizon Media workspace</p>

        {error && (
          <div className="chip chip-warn mb-4 w-full justify-center py-2.5 text-[12.5px]">
            {ERROR_MESSAGE[error] ?? "Something went wrong — try again."}
          </div>
        )}

        <form action={authenticate} className="card flex flex-col gap-3 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Email</span>
            <input name="email" type="email" required placeholder="you@company.com" className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Password</span>
            <input name="password" type="password" required placeholder="••••••••" className="input" />
          </label>
          <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
