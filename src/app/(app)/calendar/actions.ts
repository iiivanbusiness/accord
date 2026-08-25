"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { syncWorkspaceCalendar } from "@/lib/google-calendar";
import { requireWorkspaceId } from "@/lib/workspace";

export async function createEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim() || null;
  const startTimeRaw = String(formData.get("startTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? 30);
  const platform = String(formData.get("platform") ?? "zoom");
  const meetingUrl = String(formData.get("meetingUrl") ?? "").trim() || null;

  if (!title || !startTimeRaw) throw new Error("Title and start time are required");

  const workspaceId = await requireWorkspaceId();

  await prisma.calendarEvent.create({
    data: {
      workspaceId,
      title,
      clientName,
      startTime: new Date(startTimeRaw),
      durationMinutes,
      platform,
      meetingUrl,
    },
  });

  redirect("/calendar");
}

export async function deleteEvent(eventId: string) {
  const workspaceId = await requireWorkspaceId();
  await prisma.calendarEvent.deleteMany({ where: { id: eventId, workspaceId } });
  revalidatePath("/calendar");
}

export async function syncGoogleCalendarNow() {
  const workspaceId = await requireWorkspaceId();

  let redirectTo = "/calendar?error=google_sync_failed";
  try {
    const count = await syncWorkspaceCalendar(workspaceId);
    redirectTo = `/calendar?synced=${count}`;
  } catch {
    // fall through to the error redirect set above
  }
  redirect(redirectTo);
}

export async function disconnectGoogleCalendar() {
  const workspaceId = await requireWorkspaceId();
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { googleAccessToken: null, googleRefreshToken: null, googleTokenExpiresAt: null, googleAccountEmail: null },
  });
  revalidatePath("/calendar");
}
