import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { importSalesforceLeads, leadIdsFromOutboundMessage, OUTBOUND_MESSAGE_ACK } from "@/lib/salesforce-leads";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

const ack = () => new NextResponse(OUTBOUND_MESSAGE_ACK, { headers: { "Content-Type": "text/xml; charset=utf-8" } });

// A Salesforce Flow calls this (an outbound message) when a Lead is created
// or changed. The workspace is found by the key in the URL, which only that
// workspace's Settings shows. The message is acknowledged right away
// (Salesforce retries anything slow or failed), and the Leads are read and
// brought in afterwards.
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^[a-f0-9]{48}$/.test(key)) return NextResponse.json({ error: "Unknown key" }, { status: 401 });
  const workspace = await prisma.workspace.findUnique({ where: { salesforceWebhookKey: key }, select: { id: true, salesforceWebhookKey: true, salesforceLeadImport: true } });
  const stored = workspace?.salesforceWebhookKey ?? "";
  if (!workspace || stored.length !== key.length || !crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(key))) {
    return NextResponse.json({ error: "Unknown key" }, { status: 401 });
  }

  const body = await req.text();
  if (body.length > 2_000_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const ids = leadIdsFromOutboundMessage(body);

  // Import turned off: still acknowledge, or Salesforce keeps retrying.
  if (ids.length && workspace.salesforceLeadImport) {
    after(async () => {
      try {
        await importSalesforceLeads(workspace.id, ids);
      } catch (err) {
        console.error("Salesforce webhook import failed", err);
        await reportError(err, "Salesforce webhook import", { workspaceId: workspace.id });
      }
    });
  }
  return ack();
}
