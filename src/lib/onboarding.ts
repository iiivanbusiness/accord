import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "sealme_onboarding";

export type OnboardingAnswers = {
  role: string;
  callVolume: string;
  handoff: string;
  biggestProblem: string;
};

export async function saveOnboardingAnswers(answers: OnboardingAnswers) {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(answers), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour — long enough to get through signup, short enough not to linger
    path: "/",
  });
}

// Reads and clears the onboarding cookie, so it's only ever applied to the
// one signup it was collected for. Called from both signup paths
// (credentials and Google) right after a new workspace is created.
export async function consumeOnboardingAnswers(): Promise<OnboardingAnswers | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.role && parsed.callVolume && parsed.handoff && parsed.biggestProblem) {
      return parsed as OnboardingAnswers;
    }
  } catch {
    // malformed/tampered cookie — ignore
  }
  return null;
}

export async function attachOnboardingProfile(workspaceId: string) {
  const answers = await consumeOnboardingAnswers();
  if (!answers) return;
  await prisma.onboardingProfile.create({ data: { workspaceId, ...answers } });
}
