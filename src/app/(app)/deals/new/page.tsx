import Link from "next/link";
import { prisma } from "@/lib/db";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { isRecallConfigured } from "@/lib/recall";
import { requireWorkspaceId } from "@/lib/workspace";
import { createDeal, createDealFromTranscript, startCallBot, startCallFromEvent } from "./actions";

function formatEventWhen(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const day = sameDay(date, today) ? "Today" : sameDay(date, tomorrow) ? "Tomorrow" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

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
  searchParams: Promise<{ mode?: string; source?: string; error?: string }>;
}) {
  const { mode, source, error } = await searchParams;
  const isManual = mode === "manual";
  const isLive = mode === "live";
  const isTranscript = !isManual && !isLive;
  const isScheduled = isLive && source === "calendar";
  const workspaceId = await requireWorkspaceId();
  const extractionConfigured = isExtractionConfigured();
  const recallConfigured = isRecallConfigured();

  const [templates, upcomingEvents] = await Promise.all([
    prisma.contractTemplate.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    isLive
      ? prisma.calendarEvent.findMany({
          where: { workspaceId, startTime: { gte: new Date() }, meetingUrl: { not: null }, linkedDealId: null },
          orderBy: { startTime: "asc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
    <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
      ← Deals
    </Link>

    <div className="mb-6 max-w-[560px]">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Start a call</h1>
      <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        {isLive
          ? "A notetaker joins the call — deal terms land here automatically once it ends."
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
        <>
          <div className="mb-4 flex gap-2">
            <ModeTab href="/deals/new?mode=live" active={!isScheduled}>Instant meeting</ModeTab>
            <ModeTab href="/deals/new?mode=live&source=calendar" active={isScheduled}>From your calendar</ModeTab>
          </div>

          {isScheduled ? (
            upcomingEvents.length === 0 ? (
              <div className="card max-w-[560px] p-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
                No upcoming calendar events with a meeting link yet.{" "}
                <Link href="/calendar/new" className="font-medium" style={{ color: "var(--accent-blue)" }}>
                  Add one
                </Link>{" "}
                (or connect Google Calendar) — once it has a Zoom/Meet link, it&apos;ll show up here.
              </div>
            ) : (
              <form action={startCallFromEvent} className="card flex max-w-[560px] flex-col gap-4 p-6">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Upcoming call</span>
                  <select name="eventId" required className="input">
                    <option value="" style={{ background: "var(--surface-1)" }}>
                      Choose an event
                    </option>
                    {upcomingEvents.map((e) => (
                      <option key={e.id} value={e.id} style={{ background: "var(--surface-1)" }}>
                        {formatEventWhen(e.startTime)} — {e.clientName ?? e.title}
                      </option>
                    ))}
                  </select>
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
                  Schedule the notetaker
                </button>
                <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                  The bot joins on its own at the event&apos;s start time — no need to keep this tab open.
                </span>
              </form>
            )
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
                A bot named &quot;SealMe Notetaker&quot; joins the call now, listens, and leaves once it ends.
              </span>
            </form>
          )}
        </>
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
    </>
  );
}
