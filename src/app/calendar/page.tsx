import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

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

export default async function CalendarPage() {
  const events = await prisma.calendarEvent.findMany({ orderBy: { startTime: "asc" } });

  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const key = formatDay(event.startTime);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  return (
    <AppShell active="/calendar" screenLabel="Calendar">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-bold">Calendar</h1>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Upcoming calls Accord will pick up automatically
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        Connected to Google Calendar — calls with a Zoom or Meet link are matched to a client automatically
      </div>

      {events.length === 0 ? (
        <div className="glass rounded-[20px] px-6 py-10 text-center text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Nothing on the calendar yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([day, dayEvents]) => (
            <div key={day}>
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                {day}
              </div>
              <div className="glass overflow-hidden rounded-[20px]">
                {dayEvents.map((event, i) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                    style={i < dayEvents.length - 1 ? { borderBottom: "1px solid var(--glass-border-soft)" } : undefined}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="font-mono-tab flex w-[68px] flex-none flex-col items-start rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold"
                        style={{ background: "var(--glass-strong)", border: "1px solid var(--glass-border)" }}
                      >
                        {formatTime(event.startTime)}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold">{event.title}</div>
                        <div className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
                          {event.clientName ?? "No client matched yet"} · {event.durationMinutes} min
                        </div>
                      </div>
                    </div>
                    <span
                      className="rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize"
                      style={{
                        borderColor: "var(--glass-border)",
                        color: event.platform === "zoom" ? "#8FB8F0" : "#7FDB9A",
                        background: event.platform === "zoom" ? "rgba(74,144,226,.14)" : "rgba(52,168,83,.14)",
                      }}
                    >
                      {event.platform}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
