"use client";

import { useState, useTransition } from "react";

type ApprovalItem = {
  id: string;
  order: number;
  status: string; // pending | approved | rejected
  roleId: string;
  roleName: string;
  decidedByName: string | null;
  decidedOnBehalfOfName: string | null;
  decidedAt: Date | null;
  note: string | null;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ApprovalStepper({
  dealId,
  approvals,
  currentUserRoleId,
  currentUserCanApprove,
  delegatedRoleIds,
  decideAction,
}: {
  dealId: string;
  approvals: ApprovalItem[];
  currentUserRoleId: string | null;
  currentUserCanApprove: boolean;
  delegatedRoleIds: string[];
  decideAction: (dealId: string, approvalId: string, decision: "approve" | "reject", formData: FormData) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStep = approvals.find((a) => a.status === "pending");
  const actingAsDelegate = Boolean(currentStep && delegatedRoleIds.includes(currentStep.roleId));
  const canDecideCurrent = Boolean(
    currentStep && ((currentUserCanApprove && currentUserRoleId === currentStep.roleId) || actingAsDelegate)
  );

  function decide(decision: "approve" | "reject") {
    if (!currentStep) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("note", note);
        await decideAction(dealId, currentStep.id, decision, formData);
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="card mb-[18px]">
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Approval</h2>
      </div>
      <div className="px-5 py-2">
        {error && (
          <div className="my-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
            {error}
          </div>
        )}
        {approvals.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3.5 border-b py-3 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
            <div className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-medium"
                style={{
                  background: a.status === "approved" ? "var(--accent-blue)" : a.status === "rejected" ? "#c0392b" : "var(--surface-2)",
                  color: a.status === "pending" ? "var(--ink)" : "#fff",
                }}
              >
                {a.status === "approved" ? "✓" : a.status === "rejected" ? "✕" : a.order}
              </span>
              <div>
                <div className="text-[13.5px] font-medium">{a.roleName}</div>
                {a.decidedByName && (
                  <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                    {a.status === "approved" ? "Approved" : "Rejected"} by {a.decidedByName}
                    {a.decidedOnBehalfOfName ? ` (on behalf of ${a.decidedOnBehalfOfName})` : ""}
                    {a.decidedAt ? ` · ${formatDate(a.decidedAt)}` : ""}
                  </div>
                )}
                {a.note && (
                  <div className="mt-1 text-[12px] italic" style={{ color: "var(--ink-muted)" }}>&ldquo;{a.note}&rdquo;</div>
                )}
              </div>
            </div>
            {a.status === "pending" && <span className="chip chip-neutral flex-none" style={{ fontSize: 11 }}>Waiting</span>}
          </div>
        ))}

        {canDecideCurrent && (
          <div className="py-3.5">
            {actingAsDelegate && (
              <div className="mb-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
                You&apos;re deciding this as an approval backup, not directly in {currentStep?.roleName}.
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="input mb-2.5 w-full"
              style={{ fontSize: "13px", padding: "8px 11px" }}
            />
            <div className="flex gap-2">
              <button type="button" disabled={isPending} onClick={() => decide("approve")} className="btn btn-primary flex-1 justify-center">
                Approve
              </button>
              <button type="button" disabled={isPending} onClick={() => decide("reject")} className="btn btn-secondary flex-1 justify-center">
                Request changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
