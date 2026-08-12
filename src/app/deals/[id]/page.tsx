import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call…",
  missing_info: "Missing info",
  ready: "Ready for review",
  sent: "Sent — awaiting signature",
  signed: "Signed",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { client: true, fields: { orderBy: { orderIndex: "asc" } }, template: true },
  });
  if (!deal) notFound();

  const groups = new Map<string, typeof deal.fields>();
  for (const field of deal.fields) {
    if (!groups.has(field.groupLabel)) groups.set(field.groupLabel, []);
    groups.get(field.groupLabel)!.push(field);
  }
  const missing = deal.fields.filter((f) => f.status === "missing");

  return (
    <AppShell active="/deals" screenLabel="Deal">
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold">{deal.client.name}</h1>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            {deal.service}
            {deal.callLength ? ` · from a ${deal.callLength}` : ""}
          </div>
        </div>
        <span className={`pill pill-${deal.status}`}>
          <span className="pill-dot" />
          {STATUS_LABEL[deal.status] ?? deal.status}
        </span>
      </div>

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "1fr 300px" }}>
        <div className="glass rounded-[20px]">
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--glass-border-soft)" }}>
            <h2 className="text-[15px] font-bold">Deal terms</h2>
          </div>
          <div className="px-5 py-1.5">
            {[...groups.entries()]
              .filter(([label]) => label !== "Missing")
              .map(([label, rows]) => (
                <div key={label} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--glass-border-soft)" }}>
                  <div className="pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                    {label}
                  </div>
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>{row.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold">{row.value}</span>
                        {row.sourceQuote && (
                          <span title={row.sourceQuote} className="cursor-help text-[11px]" style={{ color: "var(--ink-faint)" }}>
                            ⓘ
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {missing.length > 0 ? (
            <div className="glass rounded-[20px]" style={{ borderColor: "rgba(245,185,77,.28)" }}>
              <div className="rounded-t-[20px] border-b px-5 py-4" style={{ background: "var(--warn-soft)", borderColor: "rgba(245,185,77,.2)" }}>
                <h2 className="text-[15px] font-bold" style={{ color: "var(--warn)" }}>Missing information</h2>
              </div>
              <div className="px-5 py-3">
                {missing.map((m) => (
                  <div key={m.id} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--glass-border-soft)" }}>
                    <div className="text-[13px] font-semibold">{m.label}</div>
                    <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>Not mentioned in the call — add it during review.</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass flex items-center gap-2 rounded-[20px] px-5 py-4 text-[13.5px] font-semibold" style={{ color: "var(--accent)" }}>
              ✓ All required information captured
            </div>
          )}

          <div className="glass flex flex-col gap-2.5 rounded-[20px] p-5">
            <button
              disabled={missing.length > 0}
              className="w-full rounded-full py-2.5 text-[13.5px] font-semibold disabled:cursor-not-allowed"
              style={
                missing.length > 0
                  ? { background: "var(--glass)", color: "var(--ink-faint)" }
                  : { background: "linear-gradient(160deg, var(--accent), var(--accent-strong))", color: "var(--accent-ink)" }
              }
            >
              Generate contract
            </button>
            <span className="text-center text-[12px]" style={{ color: "var(--ink-faint)" }}>
              Uses the {deal.template?.name ?? "default"} template
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
