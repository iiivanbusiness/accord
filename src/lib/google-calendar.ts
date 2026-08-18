import { prisma } from "@/lib/db";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/google-calendar/callback`;
}

export function buildAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  location?: string;
  attendees?: { email?: string; displayName?: string }[];
};

function detectPlatform(event: GoogleEvent): string {
  const haystack = `${event.hangoutLink ?? ""} ${event.location ?? ""}`.toLowerCase();
  if (haystack.includes("zoom.us")) return "zoom";
  return "meet";
}

// Syncs the workspace's connected Google Calendar into CalendarEvent rows.
// Refreshes the access token first if it's missing/expired.
export async function syncWorkspaceCalendar(workspaceId: string): Promise<number> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!workspace.googleRefreshToken) throw new Error("Google Calendar isn't connected for this workspace");

  let accessToken = workspace.googleAccessToken;
  const expired = !workspace.googleTokenExpiresAt || workspace.googleTokenExpiresAt < new Date();
  if (!accessToken || expired) {
    const refreshed = await refreshAccessToken(workspace.googleRefreshToken);
    accessToken = refreshed.access_token;
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { googleAccessToken: accessToken, googleTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
    });
  }

  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: "25",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Calendar fetch failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { items?: GoogleEvent[] };

  let synced = 0;
  for (const event of data.items ?? []) {
    const start = event.start?.dateTime ?? event.start?.date;
    if (!start || !event.id) continue;
    const startTime = new Date(start);
    const end = event.end?.dateTime ?? event.end?.date;
    const durationMinutes = end ? Math.max(5, Math.round((new Date(end).getTime() - startTime.getTime()) / 60000)) : 30;
    const clientName = event.attendees?.find((a) => a.email && !a.email.endsWith("@horizonmedia.com"))?.displayName ?? null;

    await prisma.calendarEvent.upsert({
      where: { googleEventId: event.id },
      create: {
        workspaceId,
        googleEventId: event.id,
        title: event.summary ?? "Untitled event",
        clientName,
        startTime,
        durationMinutes,
        platform: detectPlatform(event),
      },
      update: {
        title: event.summary ?? "Untitled event",
        clientName,
        startTime,
        durationMinutes,
        platform: detectPlatform(event),
      },
    });
    synced++;
  }
  return synced;
}
