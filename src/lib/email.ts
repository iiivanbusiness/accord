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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
