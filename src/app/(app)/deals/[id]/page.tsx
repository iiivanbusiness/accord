import Link from "next/link";
import { notFound } from "next/navigation";
import DealTermsCard from "@/components/DealTermsCard";
import ContinueCallButton from "@/components/ContinueCallButton";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { fillMissingFields, generateContract, retryExtraction, updateFieldValues } from "./actions";

const CALL_SOURCE_LABEL: Record<string, string> = {
  local: "Recorded locally",
  upload: "Pasted transcript",
};

function callPreview(transcript: string): string {
  const clean = transcript.trim().replace(/\s+/g, " ");
  return clean.length > 160 ? `${clean.slice(0, 160)}…` : clean || "No transcript captured.";
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call…",
  missing_info: "Missing info",
  extraction_failed: "Couldn't process call",
  ready: "Ready for review",
  pending_approval: "Awaiting approval",
  changes_requested: "Changes requested",
  sent: "Sent — awaiting signature",
  signed: "Signed",
};

const STATUS_CHIP: Record<string, string> = {
  processing: "chip-neutral chip-live",
  missing_info: "chip-warn",
  extraction_failed: "chip-warn",
  ready: "chip-active",
  pending_approval: "chip-neutral",
  changes_requested: "chip-warn",
  sent: "chip-neutral",
  signed: "chip-success",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({
    where: { id, workspaceId },
    include: {
      client: true,
      fields: { orderBy: { orderIndex: "asc" } },
      template: true,
      contract: true,
      calls: { orderBy: { startedAt: "asc" } },
      fieldChanges: { orderBy: { changedAt: "asc" } },
    },
  });
  if (!deal) notFound();

  const historyByKey = new Map<string, typeof deal.fieldChanges>();
  for (const change of deal.fieldChanges) {
    if (!historyByKey.has(change.fieldKey)) historyByKey.set(change.fieldKey, []);
    historyByKey.get(change.fieldKey)!.push(change);
  }
  const fieldsWithHistory = deal.fields.map((field) => ({ ...field, history: historyByKey.get(field.fieldKey) ?? [] }));

  const groups = new Map<string, typeof fieldsWithHistory>();
  for (const field of fieldsWithHistory) {
    if (!groups.has(field.groupLabel)) groups.set(field.groupLabel, []);
    groups.get(field.groupLabel)!.push(field);
  }
  const missing = deal.fields.filter((f) => f.status === "missing");

  return (
    <>
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
      <div className="flex flex-none flex-col items-end gap-1.5">
        <span className={`chip ${STATUS_CHIP[deal.status] ?? "chip-neutral"}`}>
          <span className="chip-dot" />
          {STATUS_LABEL[deal.status] ?? deal.status}
        </span>
        {deal.contract?.viewedAt && (
          <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
            👁 Viewed {timeAgo(deal.contract.viewedAt)}
          </span>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-[18px]">
        {deal.summary && (
          <div className="card p-5">
            <h2 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Call summary
            </h2>
            <p className="text-[13.5px] leading-relaxed">{deal.summary}</p>
          </div>
        )}
        <DealTermsCard
          groups={[...groups.entries()].filter(([label]) => label !== "Missing")}
          updateAction={updateFieldValues.bind(null, deal.id)}
        />

        {deal.calls.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Negotiation timeline
            </h2>
            <div className="flex flex-col gap-3">
              {deal.calls.map((call, i) => (
                <div key={call.id} className="border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: "var(--hairline-soft)" }}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">Call {i + 1} — {CALL_SOURCE_LABEL[call.source] ?? call.source}</span>
                    <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                      {call.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {!call.endedAt && call.id === deal.calls[deal.calls.length - 1].id ? " · in progress" : ""}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {callPreview(call.transcript)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {deal.status !== "signed" && <ContinueCallButton dealId={deal.id} />}

        {deal.status === "processing" ? (
          <div className="card flex items-center gap-2.5 px-5 py-4 text-[13.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
            <span className="chip-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-muted)" }} />
            Analyzing the call — terms appear here live as they&apos;re mentioned.
          </div>
        ) : deal.status === "extraction_failed" ? (
          <div className="card" style={{ borderColor: "rgba(245,185,77,.28)" }}>
            <div className="rounded-t-[20px] border-b px-5 py-4" style={{ background: "var(--warn-soft)", borderColor: "rgba(245,185,77,.2)" }}>
              <h2 className="text-[15px] font-medium" style={{ color: "var(--warn)" }}>Couldn&apos;t process this call</h2>
            </div>
            <div className="px-5 py-4">
              <p className="mb-3 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Something went wrong while extracting deal terms — check your AI extraction setup (e.g. Anthropic billing) and try again.
              </p>
              <form action={retryExtraction.bind(null, deal.id)}>
                <button type="submit" className="btn btn-primary w-full justify-center">
                  Try again
                </button>
              </form>
            </div>
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
              <button type="submit" disabled={missing.length > 0 || deal.status === "processing" || deal.status === "extraction_failed"} className="btn btn-primary w-full justify-center">
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
    </>
  );
}
