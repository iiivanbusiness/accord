"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export type SidebarNavItem = {
  href: string;
  label: string;
  isActive: boolean;
  icon: React.ReactNode;
};

export default function SidebarNav({ items, onNavigate }: { items: SidebarNavItem[]; onNavigate?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  const activeHref = items.find((item) => item.isActive)?.href;

  useLayoutEffect(() => {
    const el = activeHref ? itemRefs.current.get(activeHref) : null;
    if (el) {
      setPill({ top: el.offsetTop, height: el.offsetHeight });
    } else {
      setPill(null);
    }
  }, [activeHref]);

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col gap-1">
      {pill && (
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 rounded-[10px] transition-[top,height] duration-300 ease-out"
          style={{ top: pill.top, height: pill.height, background: "var(--primary)" }}
        />
      )}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          ref={(el) => {
            if (el) itemRefs.current.set(item.href, el);
            else itemRefs.current.delete(item.href);
          }}
          className="group relative z-10 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-[color,transform] duration-150 active:scale-[0.97]"
          style={{ color: item.isActive ? "var(--on-primary)" : "var(--ink-muted)" }}
        >
          <span className="inline-flex flex-none transition-transform duration-150 group-hover:scale-[1.12]">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
