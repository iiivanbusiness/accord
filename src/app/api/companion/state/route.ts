import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dealVisibilityFilter } from "@/lib/deal-visibility";

// Backs the companion window's "Live deal terms" / "Call notes" sections —
// the active dealId only lives in the main window's localStorage (see
// LOCAL_CAPTURE_STORAGE_KEY), so the companion webview fetches it itself
// once it knows which deal that is. Same-origin session cookie auth, same
// as any other page on app.sealme.net — no bearer-token scheme needed here,
// unlike local-capture/transcribe (which comes from the Rust process, with
// no cookies at all).
export async function GET(req: Request) {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const dealId = new URL(req.url).searchParams.get("dealId");
  if (!dealId) return NextResponse.json({ error: "Missing dealId" }, { status: 400 });

  const { where } = await dealVisibilityFilter();
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId, ...where },
    select: {
      id: true,
      status: true,
      summary: true,
      client: { select: { name: true } },
      fields: { orderBy: { orderIndex: "asc" }, select: { id: true, groupLabel: true, label: true, value: true, status: true } },
      callHighlights: { orderBy: { createdAt: "asc" }, select: { id: true, type: true, body: true, sourceQuote: true } },
    },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  return NextResponse.json({
    dealId: deal.id,
    clientName: deal.client.name,
    status: deal.status,
    summary: deal.summary,
    fields: deal.fields,
    callHighlights: deal.callHighlights,
  });
}
