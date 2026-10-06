import { NextResponse } from "next/server";
import { verifyTelnyxSignature, type TelnyxEvent } from "@/lib/telnyx";
import { handleTelnyxEvent } from "@/lib/telnyx-calls";
import { reportError } from "@/lib/error-report";

// Telnyx calls this for every event on the SealMe number's Voice API app
// (call.initiated, call.answered, call.hangup, call.recording.saved...);
// see telnyx-calls.ts for what each one does.
// Fails closed: without the account's public key there's no telling a real
// event from anyone who found this URL.
export async function POST(req: Request) {
  const body = await req.text();

  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKey) {
    console.error("Telnyx webhook received but TELNYX_PUBLIC_KEY isn't set. Rejecting.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const verified = verifyTelnyxSignature({
    body,
    signature: req.headers.get("telnyx-signature-ed25519"),
    timestamp: req.headers.get("telnyx-timestamp"),
    publicKey,
  });
  if (!verified) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: TelnyxEvent;
  try {
    event = JSON.parse(body) as TelnyxEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handled before answering: the caller is waiting on SealMe to pick up.
  // A failure is reported, not retried; a resent event could repeat a
  // command that already went through.
  try {
    await handleTelnyxEvent(event);
  } catch (err) {
    await reportError(err, "Telnyx event", { event: event.data?.event_type ?? "unknown", callControlId: event.data?.payload?.call_control_id ?? null });
  }
  return NextResponse.json({ ok: true });
}
