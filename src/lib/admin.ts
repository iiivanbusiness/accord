import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function requireAdmin() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) redirect("/dashboard");
  return session!;
}
