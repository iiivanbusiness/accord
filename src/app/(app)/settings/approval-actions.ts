"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function addApprovalStep(formData: FormData) {
  const user = await requirePermission("canManageWorkspace");
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) throw new Error("Choose a role");

  const role = await prisma.role.findFirst({ where: { id: roleId, workspaceId: user.workspaceId } });
  if (!role) throw new Error("Role not found");
  if (!role.canApproveContracts) throw new Error("That role isn't eligible to approve contracts — enable it in Roles & permissions first");

  const existing = await prisma.approvalStep.findFirst({ where: { workspaceId: user.workspaceId, roleId } });
  if (existing) throw new Error("That role is already a step in the chain");

  const maxOrder = await prisma.approvalStep.aggregate({ where: { workspaceId: user.workspaceId }, _max: { order: true } });
  const order = (maxOrder._max.order ?? 0) + 1;

  await prisma.approvalStep.create({ data: { workspaceId: user.workspaceId, roleId, order } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_step.added", metadata: { role: role.name, order } });

  revalidatePath("/settings");
}

export async function removeApprovalStep(stepId: string) {
  const user = await requirePermission("canManageWorkspace");
  const step = await prisma.approvalStep.findFirst({ where: { id: stepId, workspaceId: user.workspaceId } });
  if (!step) throw new Error("Step not found");

  await prisma.approvalStep.delete({ where: { id: stepId } });

  // Close the gap left in the order sequence so later moves stay simple.
  await prisma.approvalStep.updateMany({
    where: { workspaceId: user.workspaceId, order: { gt: step.order } },
    data: { order: { decrement: 1 } },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_step.removed", metadata: { role: step.roleId } });

  revalidatePath("/settings");
}

export async function moveApprovalStep(stepId: string, direction: "up" | "down") {
  const user = await requirePermission("canManageWorkspace");
  const step = await prisma.approvalStep.findFirst({ where: { id: stepId, workspaceId: user.workspaceId } });
  if (!step) throw new Error("Step not found");

  const neighborOrder = direction === "up" ? step.order - 1 : step.order + 1;
  const neighbor = await prisma.approvalStep.findFirst({ where: { workspaceId: user.workspaceId, order: neighborOrder } });
  if (!neighbor) return; // already at the edge, nothing to do

  // @@unique([workspaceId, order]) means both rows can't briefly share an
  // order value mid-swap — stage the moving step on an out-of-range order
  // first so the swap never collides.
  await prisma.$transaction([
    prisma.approvalStep.update({ where: { id: step.id }, data: { order: -1 } }),
    prisma.approvalStep.update({ where: { id: neighbor.id }, data: { order: step.order } }),
    prisma.approvalStep.update({ where: { id: step.id }, data: { order: neighborOrder } }),
  ]);

  revalidatePath("/settings");
}
