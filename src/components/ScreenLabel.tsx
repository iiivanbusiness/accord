"use client";

import { usePathname } from "next/navigation";
import { getScreenLabel } from "@/lib/nav-config";

export default function ScreenLabel() {
  const pathname = usePathname();
  return (
    <div className="truncate text-[14px] font-medium" style={{ letterSpacing: "-0.14px", color: "var(--ink)" }}>
      {getScreenLabel(pathname)}
    </div>
  );
}
