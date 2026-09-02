"use client";

import { useState, useTransition } from "react";

type TeamItem = { id: string; name: string; memberCount: number };

export default function TeamsManager({
  teams,
  createTeamAction,
  deleteTeamAction,
}: {
  teams: TeamItem[];
  createTeamAction: (formData: FormData) => Promise<void>;
  deleteTeamAction: (teamId: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        <div className="my-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {teams.length === 0 && (
        <div className="py-3 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          No teams yet — create one to give a segment of your org (e.g. &ldquo;Sales EMEA&rdquo;) its own approval rules.
        </div>
      )}

      {teams.map((team) => (
        <div key={team.id} className="flex items-center justify-between gap-3.5 border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
          <div>
            <span className="text-[13px] font-medium">{team.name}</span>
            <span className="ml-2 text-[11.5px]" style={{ color: "var(--ink-muted)" }}>{team.memberCount} member{team.memberCount === 1 ? "" : "s"}</span>
          </div>
          <button type="button" disabled={isPending} onClick={() => run(() => deleteTeamAction(team.id))} className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
            Delete
          </button>
        </div>
      ))}

      <form action={(formData) => run(() => createTeamAction(formData))} className="flex items-center gap-2 py-3.5">
        <input name="name" placeholder="Sales EMEA" className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }} />
        <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm">+ Add team</button>
      </form>
    </div>
  );
}
