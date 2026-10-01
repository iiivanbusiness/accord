"use client";

import { useFormStatus } from "react-dom";

// A plain form submit button that disables itself and swaps its label while
// the server action runs, so a slow action can't be submitted twice.
export default function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className} style={pending ? { opacity: 0.7, cursor: "wait" } : undefined}>
      {pending ? pendingText : children}
    </button>
  );
}
