"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { joinSlackChannel } from "@/lib/slack";
import { logAudit } from "@/lib/audit";

export async function setSlackChannel(formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  const channelId = String(formData.get("channelId") ?? "");
  const channelName = String(formData.get("channelName") ?? "");
  if (!channelId) return { error: "Choose a channel" };

  const workspace = await prisma.workspace.findFirst({ where: { id: user.workspaceId } });
  if (!workspace?.slackAccessToken) return { error: "Slack isn't connected" };

  try {
    await joinSlackChannel(workspace.slackAccessToken, channelId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't join that Slack channel" };
  }
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { slackChannelId: channelId, slackChannelName: channelName } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "slack.channel_set", metadata: { channelName } });

  revalidatePath("/settings");
  return {};
}

export async function toggleSlack(): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { id: user.workspaceId } });
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { slackEnabled: !workspace.slackEnabled } });
  revalidatePath("/settings");
  return {};
}

export async function disconnectSlack(): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { slackEnabled: false, slackTeamId: null, slackTeamName: null, slackAccessToken: null, slackChannelId: null, slackChannelName: null },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "slack.disconnected" });

  revalidatePath("/settings");
  return {};
}
