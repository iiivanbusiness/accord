import Link from "next/link";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { isRecallConfigured } from "@/lib/recall";
import { createDeal, createDealFromTranscript, startCallBot } from "./actions";

function Field({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <input name={name} placeholder={placeholder} required={required} className="input" />
    </label>
  );
}

function ModeTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-sm"
      style={active ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  const isManual = mode === "manual";
  const isLive = mode === "live";
  const isTranscript = !isManual && !isLive;
  const templates = await prisma.contractTemplate.findMany({ orderBy: { name: "asc" } });
  const extractionConfigured = isExtractionConfigured();
  const recallConfigured = isRecallConfigured();

  return (
    <AppShell active="/deals" screenLabel="Upload a call">
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="mb-6 max-w-[560px]">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Upload a call</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          {isLive
            ? "Drop a meeting link in and a notetaker joins the call — deal terms land here automatically once it ends."
            : isManual
              ? "Enter what the call covered and it'll drop straight into the review flow."
              : "Paste the call transcript and Claude will pull out the deal terms for you to review."}
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        <ModeTab href="/deals/new?mode=live" active={isLive}>Start a live call</ModeTab>
        <ModeTab href="/deals/new" active={isTranscript}>Paste a transcript</ModeTab>
        <ModeTab href="/deals/new?mode=manual" active={isManual}>Enter manually</ModeTab>
      </div>

      {error && (
        <div className="chip chip-warn mb-4 max-w-[560px] w-full justify-start px-4 py-2.5 text-[12.5px]">
          {error}
        </div>
      )}

      {isManual ? (
        <form action={createDeal} className="card flex max-w-[520px] flex-col gap-4 p-6">
          <Field label="Client name" name="clientName" placeholder="Acme Fitness" required />
          <Field label="Company" name="company" placeholder="Same as client name if blank" />
          <Field label="Client email" name="email" placeholder="hello@client.com" />
          <Field label="Service" name="service" placeholder="Social Media Management" required />
          <Field label="Fee" name="feeDisplay" placeholder="€2,500 / month" required />

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Template</span>
            <select name="templateId" className="input">
              {templates.map((t) => (
                <option key={t.id} value={t.id} style={{ background: "var(--surface-1)" }}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
            Start processing
          </button>
        </form>
      ) : isLive ? (
        !recallConfigured || !extractionConfigured ? (
          <div className="card max-w-[560px] p-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Live calls aren&apos;t fully set up yet — they need both a{" "}
            <span className="font-mono-tab">RECALL_API_KEY</span> and an <span className="font-mono-tab">ANTHROPIC_API_KEY</span> in{" "}
            <span className="font-mono-tab">.env</span>
            {!recallConfigured && !extractionConfigured
              ? " (both are missing)"
              : !recallConfigured
                ? " (Recall is missing)"
                : " (Anthropic is missing)"}
            . Use{" "}
            <Link href="/deals/new?mode=manual" className="font-medium" style={{ color: "var(--accent-blue)" }}>
              manual entry
            </Link>{" "}
            for now.
          </div>
        ) : (
          <form action={startCallBot} className="card flex max-w-[560px] flex-col gap-4 p-6">
            <Field label="Meeting link" name="meetingUrl" placeholder="https://zoom.us/j/... or meet.google.com/..." required />
            <Field label="Who are you meeting with?" name="clientName" placeholder="Acme Fitness" required />

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Template</span>
              <select name="templateId" required className="input">
                <option value="" style={{ background: "var(--surface-1)" }}>
                  Choose a template
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id} style={{ background: "var(--surface-1)" }}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
              Start the notetaker
            </button>
            <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              A bot named &quot;SealMe Notetaker&quot; joins the call, listens, and leaves once it ends.
            </span>
          </form>
        )
      ) : !extractionConfigured ? (
        <div className="card max-w-[560px] p-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Transcript extraction isn&apos;t set up yet — it needs an <span className="font-mono-tab">ANTHROPIC_API_KEY</span> in <span className="font-mono-tab">.env</span>. Use{" "}
          <Link href="/deals/new?mode=manual" className="font-medium" style={{ color: "var(--accent-blue)" }}>
            manual entry
          </Link>{" "}
          for now.
        </div>
      ) : (
        <form action={createDealFromTranscript} className="card flex max-w-[560px] flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Call transcript</span>
            <textarea
              name="transcript"
              required
              rows={12}
              placeholder="Agency: Hey, thanks for hopping on...
Client: Of course, excited to talk about..."
              className="input font-mono-tab text-[12.5px]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Template</span>
            <select name="templateId" required className="input">
              <option value="" style={{ background: "var(--surface-1)" }}>
                Choose a template
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} style={{ background: "var(--surface-1)" }}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
            Extract deal terms
          </button>
        </form>
      )}
    </AppShell>
  );
}
