import { after } from "next/server";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendSignupAlertEmail } from "@/lib/email";
import { isTestEmail, NOT_TEST_EMAIL } from "@/lib/test-emails";

// Where "someone new signed up" goes. The founder's inbox unless set.
const SIGNUP_ALERT_TO = process.env.SIGNUP_ALERT_EMAIL || "ivan@sealme.net";

export type SignupInfo = { name: string; email: string; workspaceName: string; how: string };

export async function sendSignupAlert(info: SignupInfo): Promise<void> {
  const peopleSoFar = await prisma.user.count({ where: { NOT: NOT_TEST_EMAIL, workspace: { sandboxOfId: null } } });
  await sendSignupAlertEmail({
    to: SIGNUP_ALERT_TO,
    ...info,
    peopleSoFar,
    adminUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sealme.net"}/admin`,
  });
}

// Every way someone new gets into SealMe calls this: their own workspace
// (email or Google), an invite they accepted, or company SSO. It's sent
// after the response so it never slows a sign-up down, and a failed email
// never fails one. Demo and test addresses are skipped.
export function notifySignup(info: SignupInfo): void {
  if (isTestEmail(info.email) || !isEmailConfigured()) return;
  const send = () => sendSignupAlert(info).catch((err) => console.error("Sign-up alert email failed", err));
  try {
    after(send);
  } catch {
    void send();
  }
}
