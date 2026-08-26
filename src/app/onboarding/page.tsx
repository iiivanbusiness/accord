"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import { saveOnboarding } from "./actions";
import type { OnboardingAnswers } from "@/lib/onboarding";

const STEPS: { key: keyof OnboardingAnswers; question: string; options: string[] }[] = [
  {
    key: "role",
    question: "What best describes you?",
    options: ["Marketing agency", "Sales agency", "Business coach", "Consultant", "Freelancer", "Other"],
  },
  {
    key: "callVolume",
    question: "How many sales calls do you take per month?",
    options: ["1–10", "10–30", "30–100", "100+"],
  },
  {
    key: "handoff",
    question: "What happens after a prospect says “yes”?",
    options: ["I send a contract manually", "My team sends it", "I use another tool", "We don't use contracts", "It depends"],
  },
  {
    key: "biggestProblem",
    question: "What's your biggest problem?",
    options: [
      "Contracts take too long",
      "Prospects disappear after the call",
      "Too much manual work",
      "Follow-ups",
      "Getting signatures",
      "Keeping everything organized",
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [submitting, setSubmitting] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function choose(value: string) {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);

    if (!isLast) {
      setStep(step + 1);
      return;
    }

    setSubmitting(true);
    try {
      await saveOnboarding(next as OnboardingAnswers);
    } finally {
      router.push("/signup");
    }
  }

  return (
    <div className="sm-theme relative flex min-h-screen items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-between">
          <BrandLogo height={24} />
          <a href="/signup" className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
            Skip
          </a>
        </div>

        <div className="mb-5 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className="h-[3px] flex-1 rounded-full transition-colors duration-300"
              style={{ background: i <= step ? "var(--primary)" : "var(--hairline)" }}
            />
          ))}
        </div>

        <div className="card p-6">
          <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Step {step + 1} of {STEPS.length}
          </div>
          <h1 className="mb-5 text-[20px] font-medium" style={{ letterSpacing: "-0.5px" }}>
            {current.question}
          </h1>

          <div className="flex flex-col gap-2">
            {current.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={submitting}
                onClick={() => choose(option)}
                className="row-hover rounded-[12px] px-4 py-3 text-left text-[14px] font-medium transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)", color: "var(--ink)" }}
              >
                {option}
              </button>
            ))}
          </div>

          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="mt-5 text-[12.5px] font-medium"
              style={{ color: "var(--ink-muted)" }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
