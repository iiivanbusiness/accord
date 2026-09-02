"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createTeam(formData: FormData) {
  const user = await requirePermission("canManageTeam");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Team name is required");

  const existing = await prisma.team.findFirst({ where: { workspaceId: user.workspaceId, name } });
  if (existing) throw new Error("A team with that name already exists");

  await prisma.team.create({ data: { workspaceId: user.workspaceId, name } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "team.created", metadata: { name } });

  revalidatePath("/settings");
}

export async function deleteTeam(teamId: string) {
  const user = await requirePermission("canManageTeam");
  const team = await prisma.team.findFirst({
    where: { id: teamId, workspaceId: user.workspaceId },
    include: { _count: { select: { users: true, deals: true, approvalChains: true } } },
  });
  if (!team) throw new Error("Team not found");
  if (team._count.approvalChains > 0) throw new Error("An approval chain still targets this team — remove or reassign it first");

  await prisma.team.delete({ where: { id: teamId } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "team.deleted", metadata: { name: team.name, members: team._count.users, deals: team._count.deals } });

  revalidatePath("/settings");
}

export async function assignUserTeam(userId: string, formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "") || null;
  const user = await requirePermission("canManageTeam");

  const targetUser = await prisma.user.findFirst({ where: { id: userId, workspaceId: user.workspaceId } });
  if (!targetUser) throw new Error("Teammate not found");

  if (teamId) {
    const team = await prisma.team.findFirst({ where: { id: teamId, workspaceId: user.workspaceId } });
    if (!team) throw new Error("Team not found");
  }

  await prisma.user.update({ where: { id: userId }, data: { teamId } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "team.member_assigned", targetId: userId, metadata: { teamId } });

  revalidatePath("/settings");
}
