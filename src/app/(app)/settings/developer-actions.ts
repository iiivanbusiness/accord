"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateApiKey, hashApiKey } from "@/lib/api-auth";
import { isWebhookEvent, sendTestWebhook } from "@/lib/webhooks";
import { logAudit } from "@/lib/audit";

export async function createApiKey(formData: FormData): Promise<string> {
  const user = await requirePermission("canManageWorkspace");
  const name = String(formData.get("name") ?? "").trim() || "Untitled key";

  const { raw, prefix } = generateApiKey();
  await prisma.apiKey.create({ data: { workspaceId: user.workspaceId, name, keyPrefix: prefix, keyHash: hashApiKey(raw) } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "api_key.created", metadata: { name } });

  revalidatePath("/settings/developers");
  return raw;
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, workspaceId: user.workspaceId } });
  if (!key) throw new Error("Key not found");

  await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "api_key.revoked", metadata: { name: key.name } });

  revalidatePath("/settings/developers");
}

export async function createWebhookEndpoint(formData: FormData): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const url = String(formData.get("url") ?? "").trim();
  if (!/^https:\/\//.test(url)) throw new Error("Webhook URL must be an https:// address");

  const events = formData.getAll("events").map(String).filter(isWebhookEvent);
  if (events.length === 0) throw new Error("Choose at least one event");

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  await prisma.webhookEndpoint.create({ data: { workspaceId: user.workspaceId, url, events: JSON.stringify(events), secret } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "webhook.created", metadata: { url, events } });

  revalidatePath("/settings/developers");
}

export async function toggleWebhookEndpoint(endpointId: string): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, workspaceId: user.workspaceId } });
  if (!endpoint) throw new Error("Endpoint not found");

  await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { enabled: !endpoint.enabled } });
  revalidatePath("/settings/developers");
}

export async function deleteWebhookEndpoint(endpointId: string): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, workspaceId: user.workspaceId } });
  if (!endpoint) throw new Error("Endpoint not found");

  await prisma.webhookEndpoint.delete({ where: { id: endpointId } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "webhook.deleted", metadata: { url: endpoint.url } });

  revalidatePath("/settings/developers");
}

export async function sendTestWebhookEvent(endpointId: string): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, workspaceId: user.workspaceId } });
  if (!endpoint) throw new Error("Endpoint not found");

  await sendTestWebhook(endpointId);
  revalidatePath("/settings/developers");
}
