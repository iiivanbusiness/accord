"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";

async function currentUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not signed in");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Not signed in");
  return user;
}

export async function submitFeedback(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) throw new Error("Give it a short title");
  if (title.length > 120) throw new Error("Keep the title under 120 characters");

  const user = await currentUser();

  const allowed = await checkRateLimit(`feedback:submit:${user.id}`, 10, 60 * 60 * 1000);
  if (!allowed) throw new Error("Too many posts — try again later");

  const post = await prisma.feedbackPost.create({
    data: { authorId: user.id, title, description },
  });

  // The submitter's own upvote — otherwise a freshly-posted idea would show
  // 0 votes even though someone clearly wants it.
  await prisma.feedbackVote.create({ data: { postId: post.id, userId: user.id } });

  revalidatePath("/feedback");
}

export async function toggleVote(postId: string): Promise<void> {
  const user = await currentUser();

  const existing = await prisma.feedbackVote.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await prisma.feedbackVote.delete({ where: { id: existing.id } });
  } else {
    const allowed = await checkRateLimit(`feedback:vote:${user.id}`, 60, 60 * 60 * 1000);
    if (!allowed) return;
    // A post could've been deleted between page load and this click — a
    // dangling vote on a gone post isn't harmful, but there's nothing to
    // attach it to, so just no-op instead of a foreign-key error.
    const post = await prisma.feedbackPost.findUnique({ where: { id: postId } });
    if (!post) return;
    await prisma.feedbackVote.create({ data: { postId, userId: user.id } });
  }

  revalidatePath("/feedback");
}

const VALID_STATUSES = ["open", "planned", "in_progress", "done", "closed"];

export async function updateFeedbackStatus(postId: string, status: string): Promise<void> {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) throw new Error("Not allowed");
  if (!VALID_STATUSES.includes(status)) throw new Error("Invalid status");

  await prisma.feedbackPost.update({ where: { id: postId }, data: { status } });
  revalidatePath("/feedback");
}
