"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createApprovalChain(formData: FormData) {
  const user = await requirePermission("canManageWorkspace");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name the chain, e.g. \"EMEA >€50k\"");

  const teamId = String(formData.get("teamId") ?? "") || null;
  if (teamId) {
    const team = await prisma.team.findFirst({ where: { id: teamId, workspaceId: user.workspaceId } });
    if (!team) throw new Error("Team not found");
  }

  const rawMinValue = String(formData.get("minDealValue") ?? "").trim();
  const minDealValue = rawMinValue ? Number(rawMinValue) : null;
  if (minDealValue != null && (!Number.isFinite(minDealValue) || minDealValue < 0)) {
    throw new Error("Minimum deal value must be a positive number");
  }

  const maxOrder = await prisma.approvalChain.aggregate({ where: { workspaceId: user.workspaceId }, _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  await prisma.approvalChain.create({ data: { workspaceId: user.workspaceId, name, teamId, minDealValue, order } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_chain.created", metadata: { name, teamId, minDealValue } });

  revalidatePath("/settings");
}

export async function deleteApprovalChain(chainId: string) {
  const user = await requirePermission("canManageWorkspace");
  const chain = await prisma.approvalChain.findFirst({ where: { id: chainId, workspaceId: user.workspaceId } });
  if (!chain) throw new Error("Chain not found");

  await prisma.approvalChain.delete({ where: { id: chainId } });
  await prisma.approvalChain.updateMany({
    where: { workspaceId: user.workspaceId, order: { gt: chain.order } },
    data: { order: { decrement: 1 } },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_chain.deleted", metadata: { name: chain.name } });

  revalidatePath("/settings");
}

export async function moveApprovalChain(chainId: string, direction: "up" | "down") {
  const user = await requirePermission("canManageWorkspace");
  const chain = await prisma.approvalChain.findFirst({ where: { id: chainId, workspaceId: user.workspaceId } });
  if (!chain) throw new Error("Chain not found");

  const neighborOrder = direction === "up" ? chain.order - 1 : chain.order + 1;
  const neighbor = await prisma.approvalChain.findFirst({ where: { workspaceId: user.workspaceId, order: neighborOrder } });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.approvalChain.update({ where: { id: chain.id }, data: { order: -1 } }),
    prisma.approvalChain.update({ where: { id: neighbor.id }, data: { order: chain.order } }),
    prisma.approvalChain.update({ where: { id: chain.id }, data: { order: neighborOrder } }),
  ]);

  revalidatePath("/settings");
}

export async function addApprovalStep(chainId: string, formData: FormData) {
  const user = await requirePermission("canManageWorkspace");
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) throw new Error("Choose a role");

  const chain = await prisma.approvalChain.findFirst({ where: { id: chainId, workspaceId: user.workspaceId } });
  if (!chain) throw new Error("Chain not found");

  const role = await prisma.role.findFirst({ where: { id: roleId, workspaceId: user.workspaceId } });
  if (!role) throw new Error("Role not found");
  if (!role.canApproveContracts) throw new Error("That role isn't eligible to approve contracts — enable it in Roles & permissions first");

  const existing = await prisma.approvalStep.findFirst({ where: { chainId, roleId } });
  if (existing) throw new Error("That role is already a step in this chain");

  const maxOrder = await prisma.approvalStep.aggregate({ where: { chainId }, _max: { order: true } });
  const order = (maxOrder._max.order ?? 0) + 1;

  await prisma.approvalStep.create({ data: { chainId, roleId, order } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_step.added", metadata: { chain: chain.name, role: role.name, order } });

  revalidatePath("/settings");
}

export async function removeApprovalStep(stepId: string) {
  const user = await requirePermission("canManageWorkspace");
  const step = await prisma.approvalStep.findFirst({ where: { id: stepId, chain: { workspaceId: user.workspaceId } } });
  if (!step) throw new Error("Step not found");

  await prisma.approvalStep.delete({ where: { id: stepId } });

  await prisma.approvalStep.updateMany({
    where: { chainId: step.chainId, order: { gt: step.order } },
    data: { order: { decrement: 1 } },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_step.removed", metadata: { role: step.roleId } });

  revalidatePath("/settings");
}

export async function moveApprovalStep(stepId: string, direction: "up" | "down") {
  const user = await requirePermission("canManageWorkspace");
  const step = await prisma.approvalStep.findFirst({ where: { id: stepId, chain: { workspaceId: user.workspaceId } } });
  if (!step) throw new Error("Step not found");

  const neighborOrder = direction === "up" ? step.order - 1 : step.order + 1;
  const neighbor = await prisma.approvalStep.findFirst({ where: { chainId: step.chainId, order: neighborOrder } });
  if (!neighbor) return; // already at the edge, nothing to do

  // @@unique([chainId, order]) means both rows can't briefly share an
  // order value mid-swap — stage the moving step on an out-of-range order
  // first so the swap never collides.
  await prisma.$transaction([
    prisma.approvalStep.update({ where: { id: step.id }, data: { order: -1 } }),
    prisma.approvalStep.update({ where: { id: neighbor.id }, data: { order: step.order } }),
    prisma.approvalStep.update({ where: { id: step.id }, data: { order: neighborOrder } }),
  ]);

  revalidatePath("/settings");
}
