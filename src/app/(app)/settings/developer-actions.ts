"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateApiKey, hashApiKey } from "@/lib/api-auth";
import { isWebhookEvent, resendWebhookDelivery, sendTestWebhook } from "@/lib/webhooks";
import { checkPublicHttpsUrl } from "@/lib/outbound-url";
import { createSandbox, findSandbox, purgeSandbox, seedSandbox } from "@/lib/sandbox";
import { logAudit } from "@/lib/audit";

// "live" is the workspace itself; "sandbox" its sandbox. Which workspace
// that is always comes from the signed-in admin, never from the browser.
export type DevScope = "live" | "sandbox";

async function target(scope: DevScope) {
  const user = await requirePermission("canManageWorkspace");
  if (scope !== "sandbox") return { user, workspaceId: user.workspaceId, sandbox: false };
  const sandbox = await findSandbox(user.workspaceId);
  if (!sandbox) throw new Error("There's no sandbox yet");
  return { user, workspaceId: sandbox.id, sandbox: true };
}

// Audit entries go to the admin's own workspace, marked when they were
// about the sandbox.
async function audit(workspaceId: string, action: string, metadata: Record<string, unknown>, sandbox: boolean) {
  const session = await auth();
  await logAudit({ workspaceId, actorEmail: session?.user?.email, action, metadata: sandbox ? { ...metadata, sandbox: true } : metadata });
}

export async function createApiKey(scope: DevScope, formData: FormData): Promise<string> {
  const t = await target(scope);
  const name = String(formData.get("name") ?? "").trim().slice(0, 100) || "Untitled key";
  const access = formData.get("access") === "read_write" ? "read_write" : "read";

  const { raw, prefix } = generateApiKey(t.sandbox ? "test" : "live");
  await prisma.apiKey.create({ data: { workspaceId: t.workspaceId, name, access, keyPrefix: prefix, keyHash: hashApiKey(raw) } });
  await audit(t.user.workspaceId, "api_key.created", { name, access }, t.sandbox);

  revalidatePath("/settings/developers");
  return raw;
}

export async function revokeApiKey(scope: DevScope, keyId: string): Promise<{ error?: string }> {
  const t = await target(scope);
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, workspaceId: t.workspaceId } });
  if (!key) return { error: "Key not found" };

  await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  await audit(t.user.workspaceId, "api_key.revoked", { name: key.name }, t.sandbox);

  revalidatePath("/settings/developers");
  return {};
}

export async function createWebhookEndpoint(scope: DevScope, formData: FormData): Promise<{ error?: string }> {
  const t = await target(scope);
  const url = String(formData.get("url") ?? "").trim();
  const unsafe = await checkPublicHttpsUrl(url);
  if (unsafe) return { error: unsafe };

  const events = formData.getAll("events").map(String).filter(isWebhookEvent);
  if (events.length === 0) return { error: "Choose at least one event" };

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  await prisma.webhookEndpoint.create({ data: { workspaceId: t.workspaceId, url, events: JSON.stringify(events), secret } });
  await audit(t.user.workspaceId, "webhook.created", { url, events }, t.sandbox);

  revalidatePath("/settings/developers");
  return {};
}

export async function toggleWebhookEndpoint(scope: DevScope, endpointId: string): Promise<{ error?: string }> {
  const t = await target(scope);
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, workspaceId: t.workspaceId } });
  if (!endpoint) return { error: "Endpoint not found" };

  await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { enabled: !endpoint.enabled } });
  revalidatePath("/settings/developers");
  return {};
}

export async function deleteWebhookEndpoint(scope: DevScope, endpointId: string): Promise<{ error?: string }> {
  const t = await target(scope);
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, workspaceId: t.workspaceId } });
  if (!endpoint) return { error: "Endpoint not found" };

  await prisma.webhookEndpoint.delete({ where: { id: endpointId } });
  await audit(t.user.workspaceId, "webhook.deleted", { url: endpoint.url }, t.sandbox);

  revalidatePath("/settings/developers");
  return {};
}

export async function sendTestWebhookEvent(scope: DevScope, endpointId: string): Promise<{ error?: string }> {
  const t = await target(scope);
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, workspaceId: t.workspaceId } });
  if (!endpoint) return { error: "Endpoint not found" };

  await sendTestWebhook(endpointId);
  revalidatePath("/settings/developers");
  return {};
}

// Sends a past event again (same event id) to the endpoint it was meant for.
export async function resendWebhookDeliveryAction(scope: DevScope, deliveryId: string): Promise<{ error?: string }> {
  const t = await target(scope);
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, endpoint: { workspaceId: t.workspaceId } }, select: { id: true } });
  if (!delivery) return { error: "Delivery not found" };
  try {
    await resendWebhookDelivery(delivery.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't resend" };
  }
  revalidatePath("/settings/developers");
  return {};
}

export async function createSandboxAction(): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  try {
    await createSandbox(user.workspaceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't create the sandbox" };
  }
  await audit(user.workspaceId, "sandbox.created", {}, true);
  revalidatePath("/settings/developers");
  return {};
}

// Back to the sample data; keys, webhooks and templates stay.
export async function resetSandboxAction(): Promise<{ error?: string }> {
  const t = await target("sandbox");
  await purgeSandbox(t.workspaceId, { keepSetup: true });
  await seedSandbox(t.workspaceId);
  await audit(t.user.workspaceId, "sandbox.reset", {}, true);
  revalidatePath("/settings/developers");
  return {};
}

export async function deleteSandboxAction(): Promise<{ error?: string }> {
  const t = await target("sandbox");
  await purgeSandbox(t.workspaceId, { keepSetup: false });
  await audit(t.user.workspaceId, "sandbox.deleted", {}, true);
  revalidatePath("/settings/developers");
  return {};
}
