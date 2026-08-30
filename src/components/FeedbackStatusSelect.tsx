"use client";

import { useTransition } from "react";
import { updateFeedbackStatus } from "@/app/(app)/feedback/actions";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "closed", label: "Closed" },
];

export default function FeedbackStatusSelect({ postId, status }: { postId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateFeedbackStatus(postId, e.target.value))}
      className="input"
      style={{ fontSize: "12px", padding: "5px 8px", width: "auto" }}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ background: "var(--surface-1)" }}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
