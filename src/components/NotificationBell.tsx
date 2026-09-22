"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUnreadNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from "@/app/(app)/notifications/actions";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Server-fetched initial state is correct on first paint / navigation —
// the poll below (same interval pattern as CompanionPanel's live-deal
// refresh) just keeps the badge from going stale while someone sits on one
// page, since nothing pushes updates to the client in real time.
export default function NotificationBell({
  initialUnreadCount,
  initialItems,
}: {
  initialUnreadCount: number;
  initialItems: NotificationItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState(initialItems);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getUnreadNotifications();
        setUnreadCount(data.unreadCount);
        setItems(data.items);
      } catch {
        // Best-effort — a failed poll just leaves the last-known state up.
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleOpenItem(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationRead(item.id).catch(() => {});
    }
    if (item.linkUrl) router.push(item.linkUrl);
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await markAllNotificationsRead().catch(() => {});
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
        style={{ color: "var(--ink-muted)" }}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={17} height={17}>
          <path d="M5 8a5 5 0 0 1 10 0v3.5l1.5 2.5h-13L5 11.5V8z" />
          <path d="M8 16a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute right-0.5 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9px] font-semibold"
            style={{ background: "#c0392b", color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[420px] w-[320px] flex-col overflow-hidden"
        >
          <div className="flex flex-none items-center justify-between border-b px-3.5 py-2.5" style={{ borderColor: "var(--hairline)" }}>
            <span className="text-[13px] font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-[11.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
                Mark all read
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3.5 py-6 text-center text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                Nothing yet.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenItem(item)}
                  className="flex w-full flex-col gap-0.5 border-b px-3.5 py-2.5 text-left"
                  style={{ borderColor: "var(--hairline-soft)", background: item.readAt ? "transparent" : "var(--surface-2)" }}
                >
                  <div className="flex items-center gap-1.5">
                    {!item.readAt && <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "#c0392b" }} />}
                    <span className="truncate text-[12.5px] font-medium">{item.title}</span>
                  </div>
                  <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>{item.body}</span>
                  <span className="text-[10.5px]" style={{ color: "var(--ink-muted)" }}>{timeAgo(item.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
