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
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL(`/settings?error=salesforce_${error}`, req.url);
    if (errorDescription) redirectUrl.searchParams.set("error_detail", errorDescription);
    return NextResponse.redirect(redirectUrl);
  }
  if (!code || !state) return NextResponse.redirect(new URL("/settings?error=salesforce_no_code", req.url));

  try {
    await requirePermission("canManageWorkspace");
    const workspaceId = await requireWorkspaceId();
    const tokens = await exchangeSalesforceCode(code, state);
    if (tokens.workspaceId !== workspaceId) {
      throw new Error("Salesforce login started from a different workspace session");
    }

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
