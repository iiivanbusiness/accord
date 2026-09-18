"use client";

import { useState, useTransition } from "react";

// A plain `<form action={inviteTeammate}>` lets a thrown Error (e.g. "That
// email is already tied to another SealMe workspace") crash the whole page
// with Next.js's generic digest-only error screen, since a native form
// submission can't be caught client-side. Calling the action from an
// explicit submit handler instead, inside startTransition, can be —
// same pattern already used in RolesManager/TwoFactorSettings for the
// same reason.
export default function InviteTeammateForm({ inviteAction }: { inviteAction: (formData: FormData) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        await inviteAction(formData);
        form.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center">
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
          className="input flex-1"
          style={{ fontSize: "13px", padding: "8px 11px" }}
        />
        <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm">
          {isPending ? "Inviting…" : "Invite"}
        </button>
      </form>
      {error && (
        <div className="chip chip-warn mb-2 w-full justify-start px-3.5 py-2 text-[12px]">
          {error}
        </div>
      )}
    </>
  );
}
