"use client";

import { useState, useTransition } from "react";

// inviteAction returns { error } as data instead of throwing — a thrown
// Error's message gets replaced with a generic "#441" digest by Next.js in
// production (it won't leak arbitrary server exception text to the client),
// so a real validation message like "already tied to another workspace"
// would never reach the user if it were thrown. A plain
// `<form action={inviteTeammate}>` also can't read a return value at all,
// so this calls the action from an explicit submit handler instead.
export default function InviteTeammateForm({
  inviteAction,
}: {
  inviteAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        const result = await inviteAction(formData);
        if (result?.error) {
          setError(result.error);
        } else {
          form.reset();
        }
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
          className="input min-w-0 flex-1"
          style={{ fontSize: "13px", padding: "8px 11px" }}
        />
        <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm flex-none">
          {isPending ? "Inviting…" : "Invite"}
        </button>
      </form>
      {error && (
        <div
          className="chip chip-warn mb-2 w-full max-w-full justify-start break-words px-3.5 py-2 text-left text-[12px] leading-relaxed"
          style={{ whiteSpace: "normal" }}
        >
          {error}
        </div>
      )}
    </>
  );
}
