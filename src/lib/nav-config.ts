export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

// The sidebar, in groups. "Prospecting" (leads, tasks, calls) only shows
// for workspaces with prospectingEnabled (see src/lib/prospecting.ts),
// and Admin only for platform admins.
const OVERVIEW: NavGroup = {
  label: "Overview",
  items: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
    { href: "/calendar", label: "Calendar" },
  ],
};
const PROSPECTING: NavGroup = {
  label: "Prospecting",
  items: [
    { href: "/today", label: "Today" },
    { href: "/leads", label: "Leads" },
  ],
};
const CLOSING: NavGroup = {
  label: "Closing",
  items: [
    { href: "/deals", label: "Deals" },
    { href: "/clients", label: "Clients" },
    { href: "/templates", label: "Templates" },
  ],
};
const WORKSPACE: NavGroup = {
  label: "Workspace",
  items: [
    { href: "/feedback", label: "Feedback" },
    { href: "/settings", label: "Settings" },
  ],
};
export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin" };
// Only for people who can manage the team (they assign the work).
const TEAM_ITEM: NavItem = { href: "/team", label: "Team" };

export function navGroupsFor({ prospecting, admin, manager = false }: { prospecting: boolean; admin: boolean; manager?: boolean }): NavGroup[] {
  const workspace = admin ? { ...WORKSPACE, items: [...WORKSPACE.items, ADMIN_ITEM] } : WORKSPACE;
  const prospectingGroup = manager ? { ...PROSPECTING, items: [...PROSPECTING.items, TEAM_ITEM] } : PROSPECTING;
  return prospecting ? [OVERVIEW, prospectingGroup, CLOSING, workspace] : [OVERVIEW, CLOSING, workspace];
}

// Every item a regular member sees, in sidebar order (the AI help chat
// describes the app from this).
export const NAV_ITEMS: NavItem[] = navGroupsFor({ prospecting: false, admin: false }).flatMap((g) => g.items);

// The phone's bottom bar has room for four buttons plus "More". Reps live
// in prospecting on the phone, so those come first when it's on; anything
// not built yet is skipped and the next item fills its spot.
const MOBILE_PRIORITY_PROSPECTING = ["/today", "/leads", "/calls", "/deals", "/dashboard"];
const MOBILE_PRIORITY_DEFAULT = ["/dashboard", "/deals", "/calendar", "/clients"];

export function mobilePrimaryItems(groups: NavGroup[], prospecting: boolean, count = 4): NavItem[] {
  const all = groups.flatMap((g) => g.items);
  const priority = prospecting ? MOBILE_PRIORITY_PROSPECTING : MOBILE_PRIORITY_DEFAULT;
  const picked = priority.map((href) => all.find((i) => i.href === href)).filter((i): i is NavItem => Boolean(i));
  for (const item of all) if (picked.length < count && !picked.includes(item)) picked.push(item);
  return picked.slice(0, count);
}

const SCREEN_LABELS: { test: (path: string) => boolean; label: string }[] = [
  { test: (p) => p === "/dashboard", label: "Dashboard" },
  { test: (p) => p === "/today", label: "Today" },
  { test: (p) => p === "/team", label: "Team" },
  { test: (p) => p === "/deals/new", label: "Start a call" },
  { test: (p) => /^\/deals\/[^/]+\/contract$/.test(p), label: "Contract review" },
  { test: (p) => /^\/deals\/[^/]+\/send$/.test(p), label: "Send contract" },
  { test: (p) => /^\/deals\/[^/]+$/.test(p), label: "Deal" },
  { test: (p) => p === "/deals", label: "Deals" },
  { test: (p) => p === "/leads/new", label: "New lead" },
  { test: (p) => p === "/leads/import", label: "Import leads" },
  { test: (p) => /^\/leads\/[^/]+$/.test(p), label: "Lead" },
  { test: (p) => p === "/leads", label: "Leads" },
  { test: (p) => p === "/calendar/new", label: "New event" },
  { test: (p) => p === "/calendar", label: "Calendar" },
  { test: (p) => p === "/analytics", label: "Analytics" },
  { test: (p) => p === "/clients", label: "Clients" },
  { test: (p) => p === "/templates/new", label: "New template" },
  { test: (p) => p === "/templates/upload", label: "Upload template" },
  { test: (p) => /^\/templates\/[^/]+\/edit$/.test(p), label: "Edit template" },
  { test: (p) => /^\/templates\/[^/]+$/.test(p), label: "Template" },
  { test: (p) => p === "/templates", label: "Templates" },
  { test: (p) => p === "/feedback", label: "Feedback" },
  { test: (p) => p === "/settings", label: "Settings" },
  { test: (p) => p === "/admin", label: "Admin" },
];

export function getScreenLabel(pathname: string): string {
  return SCREEN_LABELS.find((entry) => entry.test(pathname))?.label ?? "SealMe";
}
