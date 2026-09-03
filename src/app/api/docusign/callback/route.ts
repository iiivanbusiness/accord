import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeDocusignCode, createConnectSubscription } from "@/lib/docusign";
import { requireWorkspaceId } from "@/lib/workspace";
import { requirePermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/settings?error=docusign_${error}`, req.url));
  if (!code) return NextResponse.redirect(new URL("/settings?error=docusign_no_code", req.url));

  try {
    await requirePermission("canManageWorkspace");
    const workspaceId = await requireWorkspaceId();
    const tokens = await exchangeDocusignCode(code);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        docusignAccessToken: tokens.accessToken,
        docusignRefreshToken: tokens.refreshToken,
        docusignTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        docusignAccountId: tokens.accountId,
        docusignBaseUri: tokens.baseUri,
        docusignAccountEmail: tokens.accountEmail,
        docusignEnabled: true,
      },
    });

    // Best-effort — a failed Connect subscription doesn't block using
    // DocuSign, it just means completions won't auto-sync here yet.
    await createConnectSubscription(workspaceId).catch((err) => console.error("DocuSign Connect subscription failed", err));

    const session = await auth();
    await logAudit({ workspaceId, actorEmail: session?.user?.email, action: "docusign.connected", metadata: { accountEmail: tokens.accountEmail } });

    return NextResponse.redirect(new URL("/settings?docusign_connected=1", req.url));
  } catch (err) {
    console.error("DocuSign OAuth callback failed", err);
    return NextResponse.redirect(new URL("/settings?error=docusign_token_exchange", req.url));
  }
}
