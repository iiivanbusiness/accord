"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead, type NotificationItem } from "@/app/(app)/notifications/actions";

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// The Notifications line opened: the latest ones, new ones marked with a
// dot. A tap marks it read and goes where it points.
export default function DashboardNotifications({ items: initial }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const unread = items.filter((n) => !n.readAt).length;

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      await markNotificationRead(item.id).catch(() => {});
    }
    if (item.linkUrl) router.push(item.linkUrl);
  }

  async function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await markAllNotificationsRead().catch(() => {});
  }

  if (items.length === 0) {
    return <div className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--ink-muted)" }}>Nothing yet. When someone gives you work or a contract moves, it shows up here.</div>;
  }

  return (
    <div>
      {items.map((n, i) => (
        <button
          key={n.id}
          type="button"
          onClick={() => openItem(n)}
          className="row-hover flex w-full items-start gap-3 px-4 py-3 text-left sm:px-5"
          style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}
        >
          <span aria-hidden className="mt-[7px] h-2 w-2 flex-none rounded-full" style={{ background: n.readAt ? "transparent" : "var(--tone-new)" }} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="break-words text-[13.5px]" style={{ color: "var(--ink)", fontWeight: n.readAt ? 400 : 500 }}>{n.title}</span>
            {n.body && <span className="line-clamp-2 break-words text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{n.body}</span>}
          </span>
          <span className="flex-none text-[12px]" style={{ color: "var(--ink-muted)" }}>{timeAgo(n.createdAt)}</span>
        </button>
      ))}
      {unread > 0 && (
        <div className="px-4 py-2.5 sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          <button type="button" onClick={readAll} className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}
