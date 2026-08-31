"use client";

import { useState, useTransition } from "react";

type Step = { id: string; order: number; roleId: string; roleName: string };
type RoleOption = { id: string; name: string };

export default function ApprovalChainManager({
  steps,
  eligibleRoles,
  addStepAction,
  removeStepAction,
  moveStepAction,
}: {
  steps: Step[];
  eligibleRoles: RoleOption[];
  addStepAction: (formData: FormData) => Promise<void>;
  removeStepAction: (stepId: string) => Promise<void>;
  moveStepAction: (stepId: string, direction: "up" | "down") => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const usedRoleIds = new Set(steps.map((s) => s.roleId));
  const availableRoles = eligibleRoles.filter((r) => !usedRoleIds.has(r.id));

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="px-[22px] py-2">
      {error && (
        <div className="mb-2 mt-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {steps.length === 0 && (
        <div className="py-3 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          No approval chain configured — contracts send as soon as someone clicks &ldquo;Send to client&rdquo;.
        </div>
      )}

      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center justify-between gap-3.5 border-b py-3" style={{ borderColor: "var(--hairline-soft)" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-medium" style={{ background: "var(--surface-2)" }}>
              {i + 1}
            </span>
            <span className="text-[13.5px] font-medium">{step.roleName}</span>
          </div>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              disabled={i === 0 || isPending}
              onClick={() => run(() => moveStepAction(step.id, "up"))}
              className="text-[13px]"
              style={{ color: i === 0 ? "var(--ink-muted)" : "var(--accent-blue)", opacity: i === 0 ? 0.4 : 1 }}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={i === steps.length - 1 || isPending}
              onClick={() => run(() => moveStepAction(step.id, "down"))}
              className="text-[13px]"
              style={{ color: i === steps.length - 1 ? "var(--ink-muted)" : "var(--accent-blue)", opacity: i === steps.length - 1 ? 0.4 : 1 }}
            >
              ↓
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => removeStepAction(step.id))}
              className="text-[12px] font-medium"
              style={{ color: "var(--ink-muted)" }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {availableRoles.length > 0 ? (
        <form action={(formData) => run(() => addStepAction(formData))} className="flex items-center gap-2 py-3.5">
          <select name="roleId" className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }}>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm">Add step</button>
        </form>
      ) : (
        <div className="py-3 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          {eligibleRoles.length === 0
            ? "No roles can approve contracts yet — turn on “Approve contracts” for a role above first."
            : "Every role that can approve contracts is already in the chain."}
        </div>
      )}
    </div>
  );
}
