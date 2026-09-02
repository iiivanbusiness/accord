import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeHubspotCode } from "@/lib/hubspot";
import { requireWorkspaceId } from "@/lib/workspace";
import { requirePermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/settings?error=hubspot_${error}`, req.url));
  if (!code) return NextResponse.redirect(new URL("/settings?error=hubspot_no_code", req.url));

  try {
    await requirePermission("canManageWorkspace");
    const workspaceId = await requireWorkspaceId();
    const tokens = await exchangeHubspotCode(code);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        hubspotAccessToken: tokens.access_token,
        hubspotRefreshToken: tokens.refresh_token,
        hubspotTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        hubspotPortalId: tokens.portalId,
        hubspotEnabled: true,
      },
    });

    const session = await auth();
    await logAudit({ workspaceId, actorEmail: session?.user?.email, action: "hubspot.connected", metadata: { portalId: tokens.portalId } });

    return NextResponse.redirect(new URL("/settings?hubspot_connected=1", req.url));
  } catch (err) {
    console.error("HubSpot OAuth callback failed", err);
    return NextResponse.redirect(new URL("/settings?error=hubspot_token_exchange", req.url));
  }
}
