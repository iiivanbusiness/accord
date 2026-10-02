"use client";

import { useState, useTransition } from "react";

// "Email me this list every morning", at the bottom of Today.
export default function TaskDigestToggle({ enabled, action }: { enabled: boolean; action: (enabled: boolean) => Promise<void> }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--ink-muted)" }}>
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          startTransition(async () => {
            try {
              await action(next);
            } catch {
              setOn(!next);
            }
          });
        }}
      />
      Email me this list every morning
    </label>
  );
}
