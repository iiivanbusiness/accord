import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { importHubspotContacts, verifyHubspotSignature } from "@/lib/hubspot-leads";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

type HubspotEvent = { portalId?: number; objectId?: number; subscriptionType?: string };

const CONTACT_EVENTS = new Set(["contact.creation", "contact.propertyChange", "contact.merge", "contact.restore"]);

// HubSpot calls this when a contact is created or changed in a portal that
// has SealMe's Private App webhook set up. The call is checked against the
// workspace's saved client secret, answered right away (HubSpot retries
// anything slow), and the contacts are read and brought in afterwards.
export async function POST(req: Request) {
  const body = await req.text();
  let events: HubspotEvent[];
  try {
    const parsed = JSON.parse(body);
    events = Array.isArray(parsed) ? parsed : [];
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const portalIds = [...new Set(events.map((e) => e.portalId).filter((p): p is number => typeof p === "number"))];
  if (portalIds.length !== 1) return NextResponse.json({ error: "Unknown portal" }, { status: 400 });
  const workspaces = await prisma.workspace.findMany({
    where: { hubspotPortalId: String(portalIds[0]), hubspotLeadImport: true, hubspotWebhookSecret: { not: null } },
    select: { id: true, hubspotWebhookSecret: true },
  });

  // The URL HubSpot signed is the public one; behind a proxy req.url can
  // differ, so try the configured app URL too.
  const url = new URL(req.url);
  const urls = [req.url, `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${url.pathname}${url.search}`];
  const verified = workspaces.filter((w) => urls.some((u) => verifyHubspotSignature({ secret: w.hubspotWebhookSecret!, method: "POST", url: u, body, headers: req.headers })));
  if (verified.length === 0) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const contactIds = [...new Set(events.filter((e) => CONTACT_EVENTS.has(e.subscriptionType ?? "") && e.objectId).map((e) => String(e.objectId)))];
  if (contactIds.length) {
    after(async () => {
      for (const w of verified) {
        try {
          await importHubspotContacts(w.id, contactIds);
        } catch (err) {
          await reportError(err, "HubSpot webhook import", { workspaceId: w.id });
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
