import { cookies } from "next/headers";
import { isValidTimeZone } from "@/lib/tasks";

// The browser writes its timezone into this cookie (see TimezoneSync), so
// server-rendered pages like Today know which day it is for the viewer.
export const TZ_COOKIE = "tz";

export async function cookieTimeZone(): Promise<string> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  const tz = value ? decodeURIComponent(value) : "";
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

// The calendar day an instant falls on in a timezone, as YYYY-MM-DD.
export function dayInZone(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// The instant the viewer's current day started, so "done today" means
// today on their clock rather than in UTC. Uses the current UTC offset, so
// on the day clocks change it can be an hour off; that only shifts which
// tasks count as finished today, and only for that hour.
export function startOfDayInZone(now: Date, tz: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(now)
      .map((p) => [p.type, Number(p.value)]),
  );
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offset);
}
