"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

// The number a rep calls the SealMe number from: it's how SealMe knows
// whose call it is. Empty clears it.
export async function saveMyPhoneNumber(raw: string): Promise<{ error?: string; phone?: string | null }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: "Not signed in" };

  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const phone = trimmed ? normalizePhone(trimmed) : null;
  if (trimmed && !phone) return { error: "Start with + and your country code, then the number without its leading 0, like +381 64 123 4567 or +1 512 555 0100" };

  try {
    await prisma.user.update({ where: { email }, data: { phone } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return { error: "Another SealMe user already has that number" };
    throw err;
  }
  revalidatePath("/settings");
  return { phone };
}
