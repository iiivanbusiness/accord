"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export type SidebarNavGroup = { label: string; items: SidebarNavItem[] };

export default function SidebarNav({ groups }: { groups: SidebarNavGroup[] }) {
  const items = groups.flatMap((g) => g.items);
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  const activeHref = items.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.href;

  useLayoutEffect(() => {
    const container = containerRef.current;
    function measure() {
      const el = activeHref ? itemRefs.current.get(activeHref) : null;
      setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    }
    measure();

    // On a short window the list scrolls; bring the active item into view
    // without scrolling the page itself.
    const active = activeHref ? itemRefs.current.get(activeHref) : null;
    if (container && active) {
      const top = active.offsetTop;
      const bottom = top + active.offsetHeight;
      if (top < container.scrollTop) container.scrollTop = top - 8;
      else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight + 8;
    }

    // Re-measure whenever anything in the list changes size after this
    // first paint: group headings and labels can shift once fonts and
    // styles finish loading, and the container's own size doesn't change
    // when that happens, so watching only the container left the pill a
    // row off.
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const child of Array.from(container.children)) observer.observe(child);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [activeHref]);

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {pill && (
        <div
          aria-hidden="true"
          className="nav-pill-wrap absolute left-0 right-0 transition-[top,height] duration-300 ease-out"
          style={{ top: pill.top, height: pill.height }}
        >
          <div className="nav-pill" />
        </div>
      )}
      {groups.map((group, gi) => (
        <div key={group.label} className={`flex flex-col gap-1 ${gi > 0 ? "mt-3.5" : ""}`}>
          <div className="px-3 pb-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--ink-muted)", opacity: 0.75 }}>
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.href, el);
                  else itemRefs.current.delete(item.href);
                }}
                className="group relative z-10 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-[color,transform] duration-150 active:scale-[0.97]"
                style={{ color: isActive ? "var(--on-primary)" : "var(--ink-muted)" }}
              >
                <span className="inline-flex flex-none transition-transform duration-150 group-hover:scale-[1.12]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
