"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import GlassPanel from "./GlassPanel";

export default function MobileNavDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="-ml-1.5 flex h-9 w-9 flex-none items-center justify-center rounded-[10px] md:hidden"
        style={{ color: "var(--ink)" }}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" width={19} height={19}>
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-[264px] flex-none">
            <GlassPanel className="flex h-full w-full rounded-none px-3.5 py-[22px]">{children}</GlassPanel>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-[8px]"
              style={{ color: "var(--ink-muted)" }}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" width={17} height={17}>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
