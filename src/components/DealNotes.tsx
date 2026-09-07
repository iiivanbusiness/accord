"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Note = { id: string; authorName: string; authorEmail: string; body: string; createdAt: string };

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Internal-only note thread — the "Chatter"/activity-feed gap: a plain
// place for the team to leave context on a deal, separate from client-
// facing clause comments and approval decisions.
export default function DealNotes({
  dealId,
  notes,
  currentUserEmail,
  addAction,
  deleteAction,
}: {
  dealId: string;
  notes: Note[];
  currentUserEmail: string;
  addAction: (dealId: string, body: string) => Promise<void>;
  deleteAction: (dealId: string, noteId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      try {
        await addAction(dealId, body);
        setDraft("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that note");
      }
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      try {
        await deleteAction(dealId, noteId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete that note");
      }
    });
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        Internal notes
      </h2>

      {error && (
        <div className="mb-3 rounded-[8px] px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {notes.length === 0 && (
          <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            No notes yet — leave context here for the team, not visible to the client.
          </p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: "var(--hairline-soft)" }}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium">{note.authorName}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>{timeAgo(note.createdAt)}</span>
                {note.authorEmail === currentUserEmail && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(note.id)}
                    className="text-[11px] font-medium"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{note.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Leave a note for the team…"
          rows={2}
          className="input"
          style={{ fontSize: "13px", padding: "8px 11px", resize: "vertical" }}
        />
        <button
          type="button"
          disabled={isPending || !draft.trim()}
          onClick={handleAdd}
          className="btn btn-secondary btn-sm self-end"
        >
          {isPending ? "Adding…" : "Add note"}
        </button>
      </div>
    </div>
  );
}
