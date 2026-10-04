"use client";

import { useState, useTransition } from "react";
import ClientText from "@/components/ClientText";

type Sandbox = { name: string; createdAt: string; deals: number; leads: number };

export default function SandboxPanel({
  sandbox,
  createAction,
  resetAction,
  deleteAction,
}: {
  sandbox: Sandbox | null;
  createAction: () => Promise<{ error?: string }>;
  resetAction: () => Promise<{ error?: string }>;
  deleteAction: () => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"reset" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) setError(result.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setConfirming(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {!sandbox ? (
        <button type="button" disabled={isPending} onClick={() => run(createAction)} className="btn btn-secondary btn-sm self-start">
          {isPending ? "Creating…" : "Create a sandbox"}
        </button>
      ) : (
        <>
          <div className="text-[12.5px]">
            <span className="font-medium">{sandbox.name}</span>
            <span style={{ color: "var(--ink-muted)" }}>
              {" "}· {sandbox.deals} {sandbox.deals === 1 ? "deal" : "deals"}, {sandbox.leads} {sandbox.leads === 1 ? "lead" : "leads"} · created <ClientText text={() => new Date(sandbox.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} />
            </span>
          </div>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span style={{ color: "var(--ink-muted)" }}>
                {confirming === "reset" ? "Its deals, clients and leads are replaced with the sample data. Keys and webhooks stay." : "The sandbox, its keys and its webhooks are deleted."}
              </span>
              <button type="button" disabled={isPending} onClick={() => run(confirming === "reset" ? resetAction : deleteAction)} className="font-medium" style={{ color: "#c0392b" }}>
                {confirming === "reset" ? "Reset" : "Delete"}
              </button>
              <button type="button" onClick={() => setConfirming(null)} style={{ color: "var(--ink-muted)" }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={isPending} onClick={() => setConfirming("reset")} className="btn btn-secondary btn-sm">
                Reset sample data
              </button>
              <button type="button" disabled={isPending} onClick={() => setConfirming("delete")} className="btn btn-secondary btn-sm">
                Delete sandbox
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
