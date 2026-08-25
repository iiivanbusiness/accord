export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/deals", label: "Deals" },
  { href: "/calendar", label: "Calendar" },
  { href: "/analytics", label: "Analytics" },
  { href: "/clients", label: "Clients" },
  { href: "/templates", label: "Templates" },
  { href: "/settings", label: "Settings" },
] as const;

export const ADMIN_ITEM = { href: "/admin", label: "Admin" } as const;

const SCREEN_LABELS: { test: (path: string) => boolean; label: string }[] = [
  { test: (p) => p === "/dashboard", label: "Dashboard" },
  { test: (p) => p === "/deals/new", label: "Start a call" },
  { test: (p) => /^\/deals\/[^/]+\/contract$/.test(p), label: "Contract review" },
  { test: (p) => /^\/deals\/[^/]+\/send$/.test(p), label: "Send contract" },
  { test: (p) => /^\/deals\/[^/]+$/.test(p), label: "Deal" },
  { test: (p) => p === "/deals", label: "Deals" },
  { test: (p) => p === "/calendar/new", label: "New event" },
  { test: (p) => p === "/calendar", label: "Calendar" },
  { test: (p) => p === "/analytics", label: "Analytics" },
  { test: (p) => p === "/clients", label: "Clients" },
  { test: (p) => p === "/templates/new", label: "New template" },
  { test: (p) => p === "/templates/upload", label: "Upload template" },
  { test: (p) => /^\/templates\/[^/]+\/edit$/.test(p), label: "Edit template" },
  { test: (p) => /^\/templates\/[^/]+$/.test(p), label: "Template" },
  { test: (p) => p === "/templates", label: "Templates" },
  { test: (p) => p === "/settings", label: "Settings" },
  { test: (p) => p === "/admin", label: "Admin" },
];

export function getScreenLabel(pathname: string): string {
  return SCREEN_LABELS.find((entry) => entry.test(pathname))?.label ?? "SealMe";
}
