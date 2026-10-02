"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUserWithRole } from "@/lib/permissions";
import { normalizeDashboard, type SavedDashboard } from "@/lib/dashboard-widgets";
import { Prisma } from "@/generated/prisma/client";

// Saves the signed-in person's own dashboard layout; null goes back to the
// default.
export async function saveDashboardLayout(layout: SavedDashboard | null): Promise<void> {
  const user = await currentUserWithRole();
  await prisma.user.update({
    where: { id: user.id },
    data: { dashboardLayout: layout ? (normalizeDashboard(layout) as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
  });
  revalidatePath("/dashboard");
}
