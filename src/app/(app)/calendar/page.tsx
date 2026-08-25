import Link from "next/link";
import { prisma } from "@/lib/db";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { requireWorkspace, requireWorkspaceId } from "@/lib/workspace";
import { deleteEvent, disconnectGoogleCalendar, syncGoogleCalendarNow } from "./actions";

function formatDay(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const ERROR_MESSAGE: Record<string, string> = {
  google_not_configured: "Google Calendar isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env first.",
  google_no_code: "Google didn't return an authorization code — try connecting again.",
  google_token_exchange: "Couldn't complete the connection with Google — try again.",
  google_sync_failed: "Couldn't sync your calendar — your connection may have expired. Try reconnecting.",
  google_access_denied: "Access was declined on Google's side, so nothing was connected.",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; synced?: string }>;
}) {
  const { error, connected, synced } = await searchParams;
  const workspaceId = await requireWorkspaceId();
  const [workspace, events] = await Promise.all([
    requireWorkspace(),
    prisma.calendarEvent.findMany({ where: { workspaceId }, orderBy: { startTime: "asc" } }),
  ]);
  const isConnected = Boolean(workspace?.googleRefreshToken);
  const configured = isGoogleCalendarConfigured();
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const key = formatDay(event.startTime);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  return (
    <>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Calendar</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          Upcoming calls SealMe will pick up automatically
        </div>
      </div>
      <Link href="/calendar/new" className="btn btn-primary">
        + New event
      </Link>
    </div>

    {error && (
      <div className="chip chip-warn mb-4 w-full justify-start px-4 py-2.5 text-[12.5px]">
        {ERROR_MESSAGE[error] ?? "Something went wrong."}
      </div>
    )}
    {connected && (
      <div className="chip chip-success mb-4 w-full justify-start px-4 py-2.5 text-[12.5px]">
        ✓ Google Calendar connected{workspace?.googleAccountEmail ? ` as ${workspace.googleAccountEmail}` : ""}.
      </div>
    )}
    {synced && (
      <div className="chip chip-success mb-4 w-full justify-start px-4 py-2.5 text-[12.5px]">
        ✓ Synced {synced} event{synced === "1" ? "" : "s"} from Google Calendar.
      </div>
    )}

    <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ background: isConnected ? "var(--success)" : "var(--ink-muted)" }} />
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          {isConnected ? (
            <>Connected to Google Calendar{workspace?.googleAccountEmail ? ` (${workspace.googleAccountEmail})` : ""} — events with a Zoom or Meet link sync automatically.</>
          ) : configured ? (
            "Not connected — link your Google Calendar to pull in upcoming calls automatically."
          ) : (
            "Google Calendar integration isn't configured yet (needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)."
          )}
        </div>
      </div>
      <div className="flex flex-none gap-2">
        {isConnected ? (
          <>
            <form action={syncGoogleCalendarNow}>
              <button type="submit" className="btn btn-secondary btn-sm">Sync now</button>
            </form>
            <form action={disconnectGoogleCalendar}>
              <button type="submit" className="btn btn-secondary btn-sm">Disconnect</button>
            </form>
          </>
        ) : (
          <a href="/api/google-calendar/connect" className="btn btn-primary btn-sm" style={!configured ? { pointerEvents: "none", opacity: 0.5 } : undefined}>
            Connect Google Calendar
          </a>
        )}
      </div>
    </div>

    {events.length === 0 ? (
      <div className="card px-6 py-10 text-center text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        Nothing on the calendar yet.
      </div>
    ) : (
      <div className="flex flex-col gap-6">
        {[...groups.entries()].map(([day, dayEvents]) => (
          <div key={day}>
            <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              {day}
            </div>
            <div className="card overflow-hidden">
              {dayEvents.map((event, i) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={i < dayEvents.length - 1 ? { borderBottom: "1px solid var(--hairline-soft)" } : undefined}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="font-mono-tab flex w-[68px] flex-none flex-col items-start rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {formatTime(event.startTime)}
                    </div>
                    <div>
                      <div className="text-[14px] font-medium">{event.title}</div>
                      <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                        {event.clientName ?? "No client matched yet"} · {event.durationMinutes} min
                        {event.googleEventId && <span> · from Google Calendar</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="chip chip-neutral capitalize">{event.platform}</span>
                    <form action={deleteEvent.bind(null, event.id)}>
                      <button type="submit" className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
    </>
  );
}
