import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";

// Public on purpose: clients on /sign and /portal can crash too. Each IP can
// only trigger a handful of reports, and reportError dedupes and caps emails.
export async function POST(req: Request) {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`client-error:ip:${ip}`, 10, 60 * 60 * 1000))) {
    return new NextResponse(null, { status: 204 });
  }

  let body: { message?: unknown; stack?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (typeof body.message !== "string" || !body.message.trim()) return new NextResponse(null, { status: 204 });
  const error = new Error(body.message.slice(0, 500));
  error.name = "BrowserError";
  if (typeof body.stack === "string") error.stack = body.stack.slice(0, 4000);
  // Route pattern only: strip ids/tokens so they don't end up in the email.
  const page = typeof body.page === "string" ? body.page.split("?")[0].replace(/\/[A-Za-z0-9_-]{16,}/g, "/[id]").slice(0, 200) : "unknown";

  await reportError(error, `Browser ${page}`, { userAgent: req.headers.get("user-agent")?.slice(0, 200) });
  return new NextResponse(null, { status: 204 });
}
