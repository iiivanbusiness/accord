"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { joinSlackChannel } from "@/lib/slack";
import { logAudit } from "@/lib/audit";

export async function setSlackChannel(formData: FormData): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const channelId = String(formData.get("channelId") ?? "");
  const channelName = String(formData.get("channelName") ?? "");
  if (!channelId) throw new Error("Choose a channel");

  const workspace = await prisma.workspace.findFirst({ where: { id: user.workspaceId } });
  if (!workspace?.slackAccessToken) throw new Error("Slack isn't connected");

  await joinSlackChannel(workspace.slackAccessToken, channelId);
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { slackChannelId: channelId, slackChannelName: channelName } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "slack.channel_set", metadata: { channelName } });

  revalidatePath("/settings");
}

export async function toggleSlack(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { id: user.workspaceId } });
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { slackEnabled: !workspace.slackEnabled } });
  revalidatePath("/settings");
}

export async function disconnectSlack(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { slackEnabled: false, slackTeamId: null, slackTeamName: null, slackAccessToken: null, slackChannelId: null, slackChannelName: null },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "slack.disconnected" });

  revalidatePath("/settings");
}
