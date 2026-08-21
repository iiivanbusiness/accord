import Link from "next/link";
import AppShell from "@/components/AppShell";
import CompanionPreview from "@/components/CompanionPreview";
import { prisma } from "@/lib/db";

type Clause = { title: string; body: string };

function fillClauses(clausesJson: string, fields: { fieldKey: string; value: string | null }[]): Clause[] {
  const values = Object.fromEntries(fields.filter((f) => f.value).map((f) => [f.fieldKey, f.value as string]));
  const clauses = JSON.parse(clausesJson) as Clause[];
  return clauses.map((c) => ({
    title: c.title,
    body: c.body.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`),
  }));
}

export default async function ConceptPage() {
  const acmeDeal = await prisma.deal.findFirst({
    where: { client: { name: "Acme Fitness" } },
    include: { contract: true, template: true, fields: true },
  });
  const clauses = acmeDeal?.template ? fillClauses(acmeDeal.template.clauses, acmeDeal.fields) : [];

  return (
    <AppShell active="/deals" screenLabel="Zoom concept">
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="chip chip-warn mb-3.5 uppercase tracking-wide" style={{ fontSize: "11px", fontWeight: 600 }}>
        Concept — not a working feature yet
      </div>

      <div className="mb-6">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>SealMe, inside your Zoom call</h1>
        <div className="mt-1 max-w-[620px] text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          The Companion overlay lives in the corner of the call itself — captured terms, anything still missing, and the full contract without ever leaving the meeting.
        </div>
      </div>

      <div className="zoom-window relative max-w-[760px]">
        <div className="zoom-titlebar">
          <span>Acme Fitness — Discovery Call</span>
          <span className="rec">
            <span className="dot" />
            REC 14:32
          </span>
        </div>
        <div className="zoom-stage">
          <div className="z-avatar-lg">AF</div>
          <span className="name-tag">Acme Fitness</span>

          <CompanionPreview templateName={acmeDeal?.template?.name ?? "Contract"} clauses={clauses} />
        </div>

        <div className="zoom-toolbar">
          <span className="z-icon">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3a2.4 2.4 0 0 1 2.4 2.4v4.2a2.4 2.4 0 1 1-4.8 0V5.4A2.4 2.4 0 0 1 10 3Z" /><path d="M6 9.2a4 4 0 0 0 8 0M10 13.2V16" /></svg>
            Mute
          </span>
          <span className="z-icon">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="9" height="8" rx="1.6" /><path d="M12.5 8.6l4-2.2v7.2l-4-2.2" /></svg>
            Stop Video
          </span>
          <span className="z-icon">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="4" width="12" height="12" rx="2" /></svg>
            Share
          </span>
          <span className="z-icon">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="7" /></svg>
            Record
          </span>
          <span className="z-icon end">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12c3-3 9-3 12 0M10 12v3" /></svg>
            Leave
          </span>
        </div>
      </div>

      <div className="mt-3 max-w-[760px] text-center text-[12px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        This overlay lives inside your Zoom window while you talk — SealMe never joins as a participant.
      </div>
    </AppShell>
  );
}
