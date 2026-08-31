import { Resend } from "resend";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(workspaceName: string, verifiedSenderEmail?: string | null): string {
  if (verifiedSenderEmail) return `${workspaceName} <${verifiedSenderEmail}>`;
  const address = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  return `${workspaceName} via SealMe <${address}>`;
}

export async function sendContractEmail(options: {
  to: string;
  subject: string;
  message: string;
  signLink: string;
  workspaceName: string;
  replyTo?: string | null;
  verifiedSenderEmail?: string | null;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const messageHtml = options.message
    .split("\n")
    .map((line) => `<p style="margin:0 0 14px;">${escapeHtml(line)}</p>`)
    .join("");

  const footer = options.verifiedSenderEmail
    ? `Sent by ${escapeHtml(options.workspaceName)}`
    : `Sent by ${escapeHtml(options.workspaceName)} via SealMe`;

  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1d1f;">
      ${messageHtml}
      <a href="${options.signLink}" style="display:inline-block;margin:12px 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        View &amp; sign the agreement
      </a>
      <p style="margin:0;font-size:12.5px;color:#6e6e73;">${footer}</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromAddress(options.workspaceName, options.verifiedSenderEmail),
    to: options.to,
    subject: options.subject,
    html,
    ...(!options.verifiedSenderEmail && options.replyTo ? { replyTo: options.replyTo } : {}),
  });

  if (error) throw new Error(error.message);
}

function systemFromAddress(): string {
  const address = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  return `SealMe <${address}>`;
}

// Internal product notifications (to the workspace's own team, not a client) —
// always sent from SealMe itself, regardless of any verified sending domain.
async function sendSystemEmail(options: { to: string[]; subject: string; bodyHtml: string }): Promise<void> {
  if (options.to.length === 0) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1d1f;">
      ${options.bodyHtml}
    </div>
  `;
  const { error } = await resend.emails.send({
    from: systemFromAddress(),
    to: options.to,
    subject: options.subject,
    html,
  });
  if (error) throw new Error(error.message);
}

export async function sendSignedNotificationEmail(options: {
  to: string[];
  clientName: string;
  templateName: string;
  contractUrl: string;
}): Promise<void> {
  await sendSystemEmail({
    to: options.to,
    subject: `${options.clientName} signed the ${options.templateName}`,
    bodyHtml: `
      <p style="margin:0 0 14px;">${escapeHtml(options.clientName)} just signed the ${escapeHtml(options.templateName)}.</p>
      <a href="${options.contractUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        View the signed contract
      </a>
    `,
  });
}

export async function sendReminderEmail(options: {
  to: string;
  clientName: string;
  workspaceName: string;
  signLink: string;
  verifiedSenderEmail?: string | null;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1d1f;">
      <p style="margin:0 0 14px;">Hi ${escapeHtml(options.clientName.split(" ")[0])}, just a friendly nudge — your agreement with ${escapeHtml(options.workspaceName)} is still waiting for a signature.</p>
      <a href="${options.signLink}" style="display:inline-block;margin:12px 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        Review &amp; sign
      </a>
    </div>
  `;
  const { error } = await resend.emails.send({
    from: fromAddress(options.workspaceName, options.verifiedSenderEmail),
    to: options.to,
    subject: `Reminder: your agreement with ${options.workspaceName} is waiting for signature`,
    html,
  });
  if (error) throw new Error(error.message);
}

export async function sendTeammateInviteEmail(options: {
  to: string;
  inviterName: string;
  workspaceName: string;
  loginUrl: string;
}): Promise<void> {
  await sendSystemEmail({
    to: [options.to],
    subject: `${options.inviterName} invited you to ${options.workspaceName} on SealMe`,
    bodyHtml: `
      <p style="margin:0 0 14px;">${escapeHtml(options.inviterName)} invited you to join <strong>${escapeHtml(options.workspaceName)}</strong> on SealMe.</p>
      <p style="margin:0 0 14px;">Sign in with Google using this email address (${escapeHtml(options.to)}) to get access.</p>
      <a href="${options.loginUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        Sign in
      </a>
    `,
  });
}

export async function sendApprovalRequestedEmail(options: {
  to: string[];
  clientName: string;
  templateName: string;
  dealUrl: string;
  roleName: string;
}): Promise<void> {
  await sendSystemEmail({
    to: options.to,
    subject: `Approval needed: ${options.clientName} — ${options.templateName}`,
    bodyHtml: `
      <p style="margin:0 0 14px;">A contract for <strong>${escapeHtml(options.clientName)}</strong> (${escapeHtml(options.templateName)}) is waiting on the <strong>${escapeHtml(options.roleName)}</strong> step before it can go out.</p>
      <a href="${options.dealUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        Review &amp; decide
      </a>
    `,
  });
}

export async function sendChangesRequestedEmail(options: {
  to: string[];
  clientName: string;
  templateName: string;
  dealUrl: string;
  decidedByName: string;
  note?: string | null;
}): Promise<void> {
  await sendSystemEmail({
    to: options.to,
    subject: `Changes requested: ${options.clientName} — ${options.templateName}`,
    bodyHtml: `
      <p style="margin:0 0 14px;">${escapeHtml(options.decidedByName)} requested changes on the contract for <strong>${escapeHtml(options.clientName)}</strong> before it can be sent.</p>
      ${options.note ? `<p style="margin:0 0 14px;font-style:italic;">&ldquo;${escapeHtml(options.note)}&rdquo;</p>` : ""}
      <a href="${options.dealUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        View deal
      </a>
    `,
  });
}

export async function sendRenewalReminderEmail(options: {
  to: string[];
  clientName: string;
  templateName: string;
  renewalDate: Date;
  autoRenews: boolean;
  renewalNote?: string | null;
  dealUrl: string;
}): Promise<void> {
  const dateLabel = options.renewalDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  await sendSystemEmail({
    to: options.to,
    subject: `${options.clientName}'s contract ${options.autoRenews ? "renews" : "ends"} on ${dateLabel}`,
    bodyHtml: `
      <p style="margin:0 0 14px;">The ${escapeHtml(options.templateName)} with <strong>${escapeHtml(options.clientName)}</strong> ${options.autoRenews ? "auto-renews" : "ends"} on <strong>${dateLabel}</strong> — coming up in the next 30 days.</p>
      ${options.renewalNote ? `<p style="margin:0 0 14px;font-style:italic;">${escapeHtml(options.renewalNote)}</p>` : ""}
      <a href="${options.dealUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        Review &amp; start renewal
      </a>
    `,
  });
}

export async function sendVerificationEmail(options: { to: string; verifyUrl: string }): Promise<void> {
  await sendSystemEmail({
    to: [options.to],
    subject: "Verify your email for SealMe",
    bodyHtml: `
      <p style="margin:0 0 14px;">One quick step — confirm this is your email address to finish setting up SealMe.</p>
      <a href="${options.verifyUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        Verify email
      </a>
      <p style="margin:0;font-size:12.5px;color:#6e6e73;">If you didn&apos;t create a SealMe account, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(options: { to: string; resetUrl: string }): Promise<void> {
  await sendSystemEmail({
    to: [options.to],
    subject: "Reset your SealMe password",
    bodyHtml: `
      <p style="margin:0 0 14px;">Someone requested a password reset for this email address. If that was you, set a new password below — this link expires in 1 hour.</p>
      <a href="${options.resetUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 22px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;">
        Reset password
      </a>
      <p style="margin:0;font-size:12.5px;color:#6e6e73;">If you didn&apos;t request this, you can ignore this email.</p>
    `,
  });
}

// Cross-tenant platform failures — sent to ADMIN_EMAILS, not any one workspace's
// team, so problems surface before a customer has to report them.
export async function sendAdminAlertEmail(options: { subject: string; details: string }): Promise<void> {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (admins.length === 0) return;

  await sendSystemEmail({
    to: admins,
    subject: `[SealMe alert] ${options.subject}`,
    bodyHtml: `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12.5px;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(options.details)}</pre>`,
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
