import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import DealTermsCard from "@/components/DealTermsCard";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { fillMissingFields, generateContract, updateFieldValues } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call…",
  missing_info: "Missing info",
  ready: "Ready for review",
  sent: "Sent — awaiting signature",
  signed: "Signed",
};

const STATUS_CHIP: Record<string, string> = {
  processing: "chip-neutral chip-live",
  missing_info: "chip-warn",
  ready: "chip-active",
  sent: "chip-neutral",
  signed: "chip-success",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({
    where: { id, workspaceId },
    include: { client: true, fields: { orderBy: { orderIndex: "asc" } }, template: true, contract: true },
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
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-medium" style={{ letterSpacing: "-0.6px" }}>{deal.client.name}</h1>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            {deal.service}
            {deal.callLength ? ` · from a ${deal.callLength}` : ""}
          </div>
        </div>
        <span className={`chip ${STATUS_CHIP[deal.status] ?? "chip-neutral"}`}>
          <span className="chip-dot" />
          {STATUS_LABEL[deal.status] ?? deal.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_300px]">
        <DealTermsCard
          groups={[...groups.entries()].filter(([label]) => label !== "Missing")}
          updateAction={updateFieldValues.bind(null, deal.id)}
        />

        <div className="flex flex-col gap-4">
          {deal.status === "processing" ? (
            <div className="card flex items-center gap-2.5 px-5 py-4 text-[13.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              <span className="chip-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-muted)" }} />
              Analyzing the call — terms appear here live as they're mentioned.
            </div>
          ) : missing.length > 0 ? (
            <div className="card" style={{ borderColor: "rgba(245,185,77,.28)" }}>
              <div className="rounded-t-[20px] border-b px-5 py-4" style={{ background: "var(--warn-soft)", borderColor: "rgba(245,185,77,.2)" }}>
                <h2 className="text-[15px] font-medium" style={{ color: "var(--warn)" }}>Missing information</h2>
              </div>
              <form action={fillMissingFields.bind(null, deal.id)} className="px-5 py-3">
                {missing.map((m) => (
                  <div key={m.id} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                    <label className="text-[13px] font-medium" htmlFor={m.id}>{m.label}</label>
                    <div className="mb-2 mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>Not mentioned in the call — add it below.</div>
                    <input id={m.id} name={m.id} required placeholder={`Add ${m.label.toLowerCase()}…`} className="input w-full" style={{ fontSize: "13px", padding: "8px 11px" }} />
                  </div>
                ))}
                <button type="submit" className="btn btn-primary mt-3 w-full justify-center">
                  Save &amp; continue
                </button>
              </form>
            </div>
          ) : (
            <div className="card flex items-center gap-2 px-5 py-4 text-[13.5px] font-medium" style={{ color: "var(--success)" }}>
              ✓ All required information captured
            </div>
          )}

          <div className="card flex flex-col gap-2.5 p-5">
            {deal.contract ? (
              <Link href={`/deals/${deal.id}/contract`} className="btn btn-primary w-full justify-center">
                View contract
              </Link>
            ) : (
              <form action={generateContract.bind(null, deal.id)}>
                <button type="submit" disabled={missing.length > 0 || deal.status === "processing"} className="btn btn-primary w-full justify-center">
                  Generate contract
                </button>
              </form>
            )}
            <span className="text-center text-[12px]" style={{ color: "var(--ink-muted)" }}>
              Uses the {deal.template?.name ?? "default"} template
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
