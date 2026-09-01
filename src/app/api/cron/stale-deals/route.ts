import { NextResponse } from "next/server";
import { sendAdminAlertEmail } from "@/lib/email";
import { runStaleDealsDigest } from "@/lib/stale-deals";

// Not wired into vercel.json as its own cron: Vercel's Hobby plan caps a
// project at 2 cron jobs, and this project already has 2 (remind,
// renewals). The actual daily trigger is piggybacked inside the renewals
// cron instead (see that route) — same schedule, no separate Vercel-side
// entry needed. This route still exists so runStaleDealsDigest can be hit
// directly (manual testing, or wired back into vercel.json as its own
// entry if the project ever moves to a plan with a higher cron limit).
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runStaleDealsDigest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Stale-deals cron crashed", err);
    try {
      await sendAdminAlertEmail({
        subject: "Stale-deals cron crashed",
        details: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
    } catch (alertErr) {
      console.error("Failed to send admin alert email", alertErr);
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
