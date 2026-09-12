"use server";

import { prisma } from "@/lib/db";
import { auth, signOut } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

async function currentUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not signed in");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Not signed in");
  return user;
}

// Deletes the signed-in user's own account and personal data — required by
// Apple Guideline 5.1.1(v) for any account-creating app. Anonymizes rather
// than hard-deletes the User row: several tables reference User with a
// required foreign key that isn't nullable (ApprovalDecision.decidedByUser,
// FeedbackPost.author, ...), because that history belongs to the workspace
// team, not just this one person — same reasoning already behind Deal.owner
// using onDelete: SetNull, and SCIM's deactivatedAt for employer-initiated
// offboarding. A hard delete would either fail on those constraints or
// erase workspace history that isn't this user's alone to delete. Wiping
// the identifying fields (name, email, password) and deactivating is a
// real, complete deletion of this person's own personal data.
export async function deleteMyAccount(formData: FormData): Promise<{ error?: string }> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await currentUser();

  if (confirmation.toLowerCase() !== "delete") {
    return { error: 'Type "delete" to confirm' };
  }

  const allowed = await checkRateLimit(`account-delete:${user.id}`, 5, 15 * 60 * 1000);
  if (!allowed) return { error: "Too many attempts — try again later" };

  // Google-only accounts have no password to check — the typed confirmation
  // above is the only gate for those.
  if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
    return { error: "That password is incorrect" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: "Deleted user",
      email: `deleted-${user.id}@deleted.sealme.net`,
      passwordHash: null,
      emailVerifiedAt: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      deactivatedAt: new Date(),
    },
  });

  await logAudit({ workspaceId: user.workspaceId, actorEmail: user.email, action: "account.self_deleted" });

  await signOut({ redirectTo: "/login?deleted=1" });
  return {};
}

// Dismisses the one-time AI-data-sharing notice (AiDisclosureModal.tsx) —
// see aiDisclosureAcknowledgedAt's doc comment in schema.prisma for why
// this exists at all.
export async function acknowledgeAiDisclosure(): Promise<void> {
  const user = await currentUser();
  if (user.aiDisclosureAcknowledgedAt) return;
  await prisma.user.update({ where: { id: user.id }, data: { aiDisclosureAcknowledgedAt: new Date() } });
}
