import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resendVerificationEmail } from "@/app/(app)/settings/actions";

export default async function EmailVerifyBanner() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const user = await prisma.user.findUnique({ where: { email }, select: { emailVerifiedAt: true } });
  if (!user || user.emailVerifiedAt) return null;

  return (
    <div
      className="mx-3.5 mb-0 mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] px-4 py-3 text-[13px]"
      style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
    >
      <span>Verify your email — check your inbox for a link from SealMe.</span>
      <form action={resendVerificationEmail}>
        <button type="submit" className="text-[12.5px] font-medium underline decoration-dotted underline-offset-2">
          Resend email
        </button>
      </form>
    </div>
  );
}
