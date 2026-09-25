"use client";

import { useOptimistic, useState, useTransition } from "react";

type Note = { id: string; authorName: string; authorEmail: string; body: string; createdAt: string; saving?: boolean };
type OptimisticChange = { type: "add"; note: Note } | { type: "delete"; noteId: string };

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
  currentUserName,
  addAction,
  deleteAction,
}: {
  dealId: string;
  notes: Note[];
  currentUserEmail: string;
  currentUserName: string;
  addAction: (dealId: string, body: string) => Promise<{ error?: string }>;
  deleteAction: (dealId: string, noteId: string) => Promise<{ error?: string }>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Shown immediately; once the action's revalidation delivers the real
  // `notes`, React swaps these for them, and drops them if the save failed.
  const [visibleNotes, applyOptimistic] = useOptimistic(notes, (state: Note[], change: OptimisticChange) =>
    change.type === "add" ? [change.note, ...state] : state.filter((n) => n.id !== change.noteId)
  );

  function handleAdd() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setDraft("");
    startTransition(async () => {
      applyOptimistic({
        type: "add",
        note: { id: `pending-${Date.now()}`, authorName: currentUserName, authorEmail: currentUserEmail, body, createdAt: new Date().toISOString(), saving: true },
      });
      const result = await addAction(dealId, body);
      if (result.error) {
        setError(result.error);
        setDraft(body);
      }
    });
  }

  function handleDelete(noteId: string) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ type: "delete", noteId });
      const result = await deleteAction(dealId, noteId);
      if (result.error) setError(result.error);
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
        {visibleNotes.length === 0 && (
          <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            No notes yet. Leave context here for the team, not visible to the client.
          </p>
        )}
        {visibleNotes.map((note) => (
          <div
            key={note.id}
            className="border-b pb-3 last:border-b-0 last:pb-0"
            style={{ borderColor: "var(--hairline-soft)", opacity: note.saving ? 0.6 : 1, transition: "opacity 0.2s ease-out" }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium">{note.authorName}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>{note.saving ? "Saving…" : timeAgo(note.createdAt)}</span>
                {note.authorEmail === currentUserEmail && !note.saving && (
                  <button
                    type="button"
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
          disabled={!draft.trim()}
          onClick={handleAdd}
          className="btn btn-secondary btn-sm self-end"
        >
          Add note
        </button>
      </div>
    </div>
  );
}
