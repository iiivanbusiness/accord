"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUserWithRole } from "@/lib/permissions";
import { isValidTimeZone } from "@/lib/tasks";

// Called by TimezoneSync when the browser's timezone differs from the one
// on file, so the morning task email goes out for the right day.
export async function saveTimeZone(tz: string): Promise<void> {
  if (typeof tz !== "string" || tz.length > 64 || !isValidTimeZone(tz)) return;
  const user = await currentUserWithRole();
  if (user.timezone === tz) return;
  await prisma.user.update({ where: { id: user.id }, data: { timezone: tz } });
}

// The "email me this list every morning" switch on Today.
export async function setTaskDigestEmail(enabled: boolean): Promise<void> {
  const user = await currentUserWithRole();
  await prisma.user.update({ where: { id: user.id }, data: { taskDigestEmail: Boolean(enabled) } });
  revalidatePath("/today");
}
