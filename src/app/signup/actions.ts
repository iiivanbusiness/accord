"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { buildDefaultTemplates } from "@/lib/default-templates";

export async function signup(formData: FormData) {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!companyName || !name || !email || !password) {
    redirect(`/signup?error=${encodeURIComponent("All fields are required.")}`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const workspace = await prisma.workspace.create({
    data: { name: companyName },
  });

  await prisma.user.create({
    data: { workspaceId: workspace.id, name, email, passwordHash: hashPassword(password) },
  });

  const templates = buildDefaultTemplates(companyName);
  await prisma.contractTemplate.createMany({
    data: templates.map((t) => ({ ...t, workspaceId: workspace.id })),
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login");
    }
    throw err;
  }
}
