import { createHash } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendAdminAlertEmail } from "@/lib/email";

// Emails ADMIN_EMAILS about failures nobody would otherwise hear about. The
// same error (by where + message) alerts at most once per window, and all
// alerts together are capped per hour, so a crash loop can't flood the inbox.
const SAME_ERROR_WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_ALERTS_PER_HOUR = 20;

// Control-flow throws from Next.js and plain signed-out requests aren't bugs.
function isExpected(err: unknown): boolean {
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") return true;
  return err instanceof Error && err.message === "Not signed in";
}

export async function reportError(err: unknown, where: string, context: Record<string, unknown> = {}): Promise<void> {
  if (process.env.NODE_ENV !== "production" && !process.env.ERROR_ALERTS_IN_DEV) return;
  if (isExpected(err)) return;

  try {
    const error = err instanceof Error ? err : new Error(String(err));
    const signature = createHash("sha256").update(`${where}|${error.name}|${error.message.slice(0, 300)}`).digest("hex").slice(0, 16);

    if (!(await checkRateLimit(`error-alert:${signature}`, 1, SAME_ERROR_WINDOW_MS))) return;
    if (!(await checkRateLimit("error-alert:all", MAX_ALERTS_PER_HOUR, 60 * 60 * 1000))) return;

    const contextLines = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

    await sendAdminAlertEmail({
      subject: `${where}: ${error.message.slice(0, 90)}`,
      details: [
        `Where: ${where}`,
        ...contextLines,
        `Environment: ${process.env.VERCEL_ENV ?? process.env.NODE_ENV}`,
        `Time: ${new Date().toISOString()}`,
        "",
        "Repeats of this exact error are muted for 6 hours.",
        "",
        error.stack ?? `${error.name}: ${error.message}`,
      ].join("\n"),
    });
  } catch (reportFailure) {
    console.error("Failed to report error", reportFailure);
  }
}
