import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeSlackCode } from "@/lib/slack";
import { requireWorkspaceId } from "@/lib/workspace";
import { requirePermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/settings?error=slack_${error}`, req.url));
  if (!code) return NextResponse.redirect(new URL("/settings?error=slack_no_code", req.url));

  try {
    await requirePermission("canManageWorkspace");
    const workspaceId = await requireWorkspaceId();
    const { accessToken, teamId, teamName } = await exchangeSlackCode(code);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { slackAccessToken: accessToken, slackTeamId: teamId, slackTeamName: teamName, slackEnabled: true },
    });

    const session = await auth();
    await logAudit({ workspaceId, actorEmail: session?.user?.email, action: "slack.connected", metadata: { teamName } });

    return NextResponse.redirect(new URL("/settings?slack_connected=1", req.url));
  } catch (err) {
    console.error("Slack OAuth callback failed", err);
    return NextResponse.redirect(new URL("/settings?error=slack_token_exchange", req.url));
  }
}
