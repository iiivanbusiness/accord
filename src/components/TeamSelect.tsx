"use client";

import { useState, useTransition } from "react";

type TeamOption = { id: string; name: string };

export default function TeamSelect({
  userId,
  currentTeamId,
  teams,
  action,
}: {
  userId: string;
  currentTeamId: string | null;
  teams: TeamOption[];
  action: (userId: string, formData: FormData) => Promise<void>;
}) {
  const [value, setValue] = useState(currentTeamId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextTeamId: string) {
    const previous = value;
    setValue(nextTeamId);
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("teamId", nextTeamId);
        await action(userId, formData);
      } catch (err) {
        setValue(previous);
        setError(err instanceof Error ? err.message : "Couldn't change team");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="input"
        style={{ fontSize: "12.5px", padding: "5px 8px", width: "auto" }}
      >
        <option value="">No team</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      {error && (
        <span className="max-w-[220px] text-right text-[11px]" style={{ color: "#c0392b" }}>
          {error}
        </span>
      )}
    </div>
  );
}
