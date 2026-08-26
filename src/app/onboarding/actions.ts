"use server";

import { saveOnboardingAnswers, type OnboardingAnswers } from "@/lib/onboarding";

export async function saveOnboarding(answers: OnboardingAnswers) {
  await saveOnboardingAnswers(answers);
}
