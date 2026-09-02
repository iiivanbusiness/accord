"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PERMISSION_FIELDS = [
  "canManageWorkspace",
  "canManageTeam",
  "canManageTemplates",
  "canApproveContracts",
  "canApproveTemplates",
  "canViewAllDeals",
] as const;

function readPermissions(formData: FormData) {
  const data: Record<(typeof PERMISSION_FIELDS)[number], boolean> = {
    canManageWorkspace: false,
    canManageTeam: false,
    canManageTemplates: false,
    canApproveContracts: false,
    canApproveTemplates: false,
    canViewAllDeals: false,
  };
  for (const field of PERMISSION_FIELDS) data[field] = formData.get(field) === "on";
  return data;
}

export async function createRole(formData: FormData) {
  const user = await requirePermission("canManageTeam");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Role name is required");

  const existing = await prisma.role.findFirst({ where: { workspaceId: user.workspaceId, name } });
  if (existing) throw new Error("A role with that name already exists");

  await prisma.role.create({
    data: { workspaceId: user.workspaceId, name, ...readPermissions(formData) },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "role.created", metadata: { name } });

  revalidatePath("/settings");
}

// The Owner role is the workspace's safety net — it's created by the system,
// always holds every permission, and can't be deleted. Locking its
// permissions too (name is still editable) means there's always at least
// one role nobody can misconfigure into a lockout.
export async function updateRole(roleId: string, formData: FormData) {
  const user = await requirePermission("canManageTeam");
  const role = await prisma.role.findFirst({ where: { id: roleId, workspaceId: user.workspaceId } });
  if (!role) throw new Error("Role not found");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Role name is required");

  if (role.isOwner) {
    await prisma.role.update({ where: { id: roleId }, data: { name } });
    revalidatePath("/settings");
    return;
  }

  const permissions = readPermissions(formData);

  // If this role currently holds canManageTeam and is about to lose it,
  // make sure some other role in the workspace still grants it — otherwise
  // nobody could ever manage roles or teammates again.
  if (role.canManageTeam && !permissions.canManageTeam) {
    const otherTeamManagers = await prisma.role.count({
      where: { workspaceId: user.workspaceId, canManageTeam: true, id: { not: roleId } },
    });
    if (otherTeamManagers === 0) {
      throw new Error("At least one role must be able to manage the team — edit another role first");
    }
  }

  await prisma.role.update({ where: { id: roleId }, data: { name, ...permissions } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "role.updated", targetId: roleId, metadata: { name } });

  revalidatePath("/settings");
}

export async function deleteRole(roleId: string) {
  const user = await requirePermission("canManageTeam");
  const role = await prisma.role.findFirst({ where: { id: roleId, workspaceId: user.workspaceId }, include: { _count: { select: { users: true } } } });
  if (!role) throw new Error("Role not found");
  if (role.isOwner) throw new Error("The Owner role can't be deleted");
  if (role._count.users > 0) throw new Error(`Reassign ${role._count.users} teammate(s) off this role before deleting it`);

  await prisma.role.delete({ where: { id: roleId } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "role.deleted", targetId: roleId, metadata: { name: role.name } });

  revalidatePath("/settings");
}

export async function assignUserRole(userId: string, formData: FormData) {
  const roleId = String(formData.get("roleId") ?? "");
  const user = await requirePermission("canManageTeam");

  const [targetUser, newRole] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, workspaceId: user.workspaceId }, include: { role: true } }),
    prisma.role.findFirst({ where: { id: roleId, workspaceId: user.workspaceId } }),
  ]);
  if (!targetUser) throw new Error("Teammate not found");
  if (!newRole) throw new Error("Role not found");

  // Never let a reassignment leave the workspace with nobody who can manage
  // the team — that would be a permanent lockout with no way back in short
  // of a database edit.
  if (targetUser.role?.canManageTeam && !newRole.canManageTeam) {
    const otherTeamManagers = await prisma.user.count({
      where: { workspaceId: user.workspaceId, id: { not: userId }, role: { canManageTeam: true } },
    });
    if (otherTeamManagers === 0) {
      throw new Error("This is the only teammate who can manage the team — assign someone else first");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { roleId } });

  const session = await auth();
  await logAudit({
    workspaceId: user.workspaceId,
    actorEmail: session?.user?.email,
    action: "role.assigned",
    targetId: userId,
    metadata: { role: newRole.name },
  });

  revalidatePath("/settings");
}
