import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeSalesforceCode } from "@/lib/salesforce";
import { requireWorkspaceId } from "@/lib/workspace";
import { requirePermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/settings?error=salesforce_${error}`, req.url));
  if (!code) return NextResponse.redirect(new URL("/settings?error=salesforce_no_code", req.url));

  try {
    await requirePermission("canManageWorkspace");
    const workspaceId = await requireWorkspaceId();
    const tokens = await exchangeSalesforceCode(code);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        salesforceAccessToken: tokens.accessToken,
        salesforceRefreshToken: tokens.refreshToken,
        salesforceTokenExpiresAt: null,
        salesforceInstanceUrl: tokens.instanceUrl,
        salesforceAccountEmail: tokens.accountEmail,
        salesforceEnabled: true,
      },
    });

    const session = await auth();
    await logAudit({ workspaceId, actorEmail: session?.user?.email, action: "salesforce.connected", metadata: { accountEmail: tokens.accountEmail } });

    return NextResponse.redirect(new URL("/settings?salesforce_connected=1", req.url));
  } catch (err) {
    console.error("Salesforce OAuth callback failed", err);
    return NextResponse.redirect(new URL("/settings?error=salesforce_token_exchange", req.url));
  }
}
