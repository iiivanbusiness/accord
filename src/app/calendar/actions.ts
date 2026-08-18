"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { syncWorkspaceCalendar } from "@/lib/google-calendar";

export async function createEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim() || null;
  const startTimeRaw = String(formData.get("startTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? 30);
  const platform = String(formData.get("platform") ?? "zoom");

  if (!title || !startTimeRaw) throw new Error("Title and start time are required");

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  await prisma.calendarEvent.create({
    data: {
      workspaceId: workspace.id,
      title,
      clientName,
      startTime: new Date(startTimeRaw),
      durationMinutes,
      platform,
    },
  });

  redirect("/calendar");
}

export async function deleteEvent(eventId: string) {
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidatePath("/calendar");
}

export async function syncGoogleCalendarNow() {
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  let redirectTo = "/calendar?error=google_sync_failed";
  try {
    const count = await syncWorkspaceCalendar(workspace.id);
    redirectTo = `/calendar?synced=${count}`;
  } catch {
    // fall through to the error redirect set above
  }
  redirect(redirectTo);
}

export async function disconnectGoogleCalendar() {
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { googleAccessToken: null, googleRefreshToken: null, googleTokenExpiresAt: null, googleAccountEmail: null },
  });
  revalidatePath("/calendar");
}
