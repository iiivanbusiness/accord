"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarRailItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

// The narrow icon-only rail sitting to the left of the labeled nav panel
// (see AppShell.tsx) — a second, physically separate strip next to it,
// same "rail + panel, two distinct surfaces" pattern already used for the
// companion window (CompanionRail.tsx), now applied to the main nav to
// match the reference's icon-rail-plus-list-panel layout.
export default function SidebarRail({ items }: { items: SidebarRailItem[] }) {
  const pathname = usePathname();
  const activeHref = items.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.href;

  return (
    <div className="flex flex-col items-center gap-1">
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] transition-colors duration-150 active:scale-[0.94]"
            style={{
              color: isActive ? "var(--ink)" : "var(--ink-muted)",
              background: isActive ? "var(--surface-2)" : "transparent",
            }}
          >
            {item.icon}
          </Link>
        );
      })}
    </div>
  );
}
