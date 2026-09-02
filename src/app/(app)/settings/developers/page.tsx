import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import ApiKeysPanel from "@/components/ApiKeysPanel";
import WebhooksPanel from "@/components/WebhooksPanel";
import { createApiKey, revokeApiKey, createWebhookEndpoint, toggleWebhookEndpoint, deleteWebhookEndpoint, sendTestWebhookEvent } from "../developer-actions";

export default async function DeveloperSettingsPage() {
  const user = await requirePermission("canManageWorkspace");

  const [apiKeys, endpoints] = await Promise.all([
    prisma.apiKey.findMany({ where: { workspaceId: user.workspaceId, revokedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.webhookEndpoint.findMany({
      where: { workspaceId: user.workspaceId },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
    <div className="mb-6">
      <Link href="/settings" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>← Settings</Link>
      <h1 className="mt-2 text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>API &amp; webhooks</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Let your own systems connect to SealMe directly — a REST API for reading and creating records, and webhooks for real-time updates.
      </div>
    </div>

    <div className="card mb-4 max-w-[600px]">
      <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">API keys</h2>
        <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          Authenticate REST requests with <code className="font-mono-tab">Authorization: Bearer &lt;key&gt;</code> against{" "}
          <code className="font-mono-tab">{process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/v1</code> — deals, clients, and contracts, read and (for clients) write.
        </div>
      </div>
      <ApiKeysPanel
        keys={apiKeys.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))}
        createAction={createApiKey}
        revokeAction={revokeApiKey}
      />
    </div>

    <div className="card mb-4 max-w-[600px]">
      <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Webhooks</h2>
        <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          We POST a signed JSON payload to your URL when one of these happens — verify it with the <code className="font-mono-tab">X-SealMe-Signature</code> header (HMAC-SHA256 of the raw body, using the secret below).
        </div>
      </div>
      <WebhooksPanel
        endpoints={endpoints.map((e) => ({
          id: e.id,
          url: e.url,
          secret: e.secret,
          events: JSON.parse(e.events) as string[],
          enabled: e.enabled,
          deliveries: e.deliveries.map((d) => ({ id: d.id, event: d.event, responseStatus: d.responseStatus, error: d.error, createdAt: d.createdAt.toISOString() })),
        }))}
        availableEvents={[...WEBHOOK_EVENTS]}
        createAction={createWebhookEndpoint}
        toggleAction={toggleWebhookEndpoint}
        deleteAction={deleteWebhookEndpoint}
        testAction={sendTestWebhookEvent}
      />
    </div>
    </>
  );
}
