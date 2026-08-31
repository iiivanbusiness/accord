"use client";

import { useState, useTransition } from "react";

type RoleOption = { id: string; name: string };

export default function RoleSelect({
  userId,
  currentRoleId,
  roles,
  action,
  disabled,
}: {
  userId: string;
  currentRoleId: string | null;
  roles: RoleOption[];
  action: (userId: string, formData: FormData) => Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(currentRoleId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextRoleId: string) {
    const previous = value;
    setValue(nextRoleId);
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("roleId", nextRoleId);
        await action(userId, formData);
      } catch (err) {
        setValue(previous);
        setError(err instanceof Error ? err.message : "Couldn't change role");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={value}
        disabled={disabled || isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="input"
        style={{ fontSize: "12.5px", padding: "5px 8px", width: "auto" }}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
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
