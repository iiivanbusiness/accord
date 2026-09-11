import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dealVisibilityFilter } from "@/lib/deal-visibility";

// Backs the companion window's "Notes" tab — recent CallHighlight rows
// across the whole workspace (not scoped to one active deal, unlike
// /api/companion/state), so a call's notes stay reachable after the call
// ends and the local-capture session that would've carried its dealId is
// long gone. Same auth pattern as that route: auth() directly, 401 JSON
// rather than requireWorkspace()'s redirect, which isn't right for a
// fetch()-consumed API.
export async function GET() {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { where } = await dealVisibilityFilter();
  const highlights = await prisma.callHighlight.findMany({
    where: { deal: { workspaceId, ...where } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      body: true,
      sourceQuote: true,
      createdAt: true,
      dealId: true,
      deal: { select: { client: { select: { name: true } } } },
    },
  });

  return NextResponse.json({
    items: highlights.map((h) => ({
      id: h.id,
      type: h.type,
      body: h.body,
      sourceQuote: h.sourceQuote,
      createdAt: h.createdAt.toISOString(),
      dealId: h.dealId,
      clientName: h.deal.client.name,
    })),
  });
}
