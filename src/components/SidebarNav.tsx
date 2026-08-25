"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export default function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  const activeHref = items.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.href;

  useLayoutEffect(() => {
    function measure() {
      const el = activeHref ? itemRefs.current.get(activeHref) : null;
      setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    }
    measure();

    // Re-measure if the list's layout shifts after this first paint (e.g. the
    // brand logo above it finishing its image load) — otherwise the pill can
    // get stuck at a stale position instead of tracking the active item.
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeHref]);

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col gap-1">
      {pill && (
        <div
          aria-hidden="true"
          className="nav-pill-wrap absolute left-0 right-0 transition-[top,height] duration-300 ease-out"
          style={{ top: pill.top, height: pill.height }}
        >
          <div className="nav-pill" />
        </div>
      )}
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(el) => {
              if (el) itemRefs.current.set(item.href, el);
              else itemRefs.current.delete(item.href);
            }}
            className="group relative z-10 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-[color,transform] duration-150 active:scale-[0.97]"
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
  );
}
