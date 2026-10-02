import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import LeadImporter from "@/components/LeadImporter";
import LocalDateTime from "@/components/LocalDateTime";
import { importLeadsChunk, startLeadImport } from "../import-actions";

const SOURCE_LABEL: Record<string, string> = { paste: "Pasted", csv: "CSV", xlsx: "Excel", hubspot: "HubSpot", salesforce: "Salesforce", manual: "By hand" };

export default async function ImportLeadsPage() {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const [owners, history] = await Promise.all([
    access.canAssign
      ? prisma.user.findMany({ where: { workspaceId: workspace.id, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.leadImport.findMany({
      where: { workspaceId: workspace.id, ...(access.canViewAll ? {} : { createdById: access.userId }) },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, source: true, fileName: true, created: true, updated: true, skipped: true, createdAt: true, createdBy: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <Link href="/leads" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Leads
      </Link>
      <div className="mb-5">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Import leads</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Paste rows from a spreadsheet, or upload an Excel or CSV file. People already here, by email or phone, aren&apos;t added twice.
        </div>
      </div>

      <LeadImporter owners={owners} canAssign={access.canAssign} startAction={startLeadImport} chunkAction={importLeadsChunk} />

      {history.length > 0 && (
        <div className="mt-8 max-w-[860px]">
          <h2 className="mb-2.5 text-[15px] font-medium">Recent imports</h2>
          <div className="card divide-y overflow-hidden" style={{ borderColor: "var(--hairline-soft)" }}>
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{h.fileName ?? SOURCE_LABEL[h.source] ?? h.source}</div>
                  <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                    {h.createdBy?.name ?? "Someone"} · <LocalDateTime iso={h.createdAt.toISOString()} options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                  </div>
                </div>
                <div className="font-mono-tab flex-none text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                  {h.created} new · {h.updated} updated · {h.skipped} skipped
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
