// The Dashboard is a short list of lines: one line per thing (the team's
// day, your next call, deals...), each with a colored dot for how urgent
// it is and a one-line summary. A tap opens the line. Each person picks
// which lines show, their order and which start open; that's saved on
// User.dashboardLines in the SavedLines shape below.

export type LineTone = "urgent" | "due" | "new" | "good" | "quiet";
export type LineRole = "manager" | "rep";

export const LINE_TITLES = {
  team: "Team today",
  next: "Next up",
  today: "Your day",
  waiting: "Waiting on you",
  notifications: "Notifications",
  saved: "Just saved",
  deals: "Deals",
  assign: "Hand out work",
  calendar: "Calendar",
  renewals: "Renewals",
  "deal-value": "Deal value by month",
} as const;

export type LineId = keyof typeof LINE_TITLES;

export const TONE_LABEL: Record<LineTone, string> = {
  urgent: "Late or urgent",
  due: "Needs you today",
  new: "New",
  good: "All good",
  quiet: "Nothing pressing",
};

type LinePrefs = { order: LineId[]; hidden: LineId[]; open: LineId[] };

// What each role starts with. Every line a role can have is in its order;
// the hidden ones can be turned on in Customize.
export const DEFAULT_LINES: Record<LineRole, LinePrefs> = {
  manager: {
    order: ["team", "next", "today", "waiting", "notifications", "deals", "assign", "calendar", "saved", "renewals", "deal-value"],
    hidden: ["saved", "renewals", "deal-value"],
    open: ["team"],
  },
  rep: {
    order: ["next", "today", "notifications", "saved", "waiting", "calendar", "deals", "renewals", "deal-value"],
    hidden: ["deals", "renewals", "deal-value"],
    open: ["next"],
  },
};

export type SavedLines = { v: 1; order: string[]; hidden: string[]; open: string[] };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 50) : []);

// The person's lines for their role. Anything stale or unknown in what they
// saved is dropped; a line they've never seen (new, or new to their role)
// goes at the end, shown or hidden as the default has it.
export function resolveLines(saved: unknown, role: LineRole): LinePrefs {
  const base = DEFAULT_LINES[role];
  if (!saved || typeof saved !== "object" || (saved as { v?: unknown }).v !== 1) return { order: [...base.order], hidden: [...base.hidden], open: [...base.open] };
  const s = saved as Record<string, unknown>;
  const allowed = new Set<string>(base.order);
  const seen = [...new Set(strings(s.order))].filter((id): id is LineId => allowed.has(id));
  const fresh = base.order.filter((id) => !seen.includes(id));
  const hidden = new Set(strings(s.hidden));
  const open = new Set(strings(s.open));
  const order = [...seen, ...fresh];
  return {
    order,
    hidden: order.filter((id) => (seen.includes(id) ? hidden.has(id) : base.hidden.includes(id))),
    open: order.filter((id) => (seen.includes(id) ? open.has(id) : base.open.includes(id))),
  };
}

// Cleans what the browser sends before it's stored.
export function toSavedLines(input: unknown): SavedLines {
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const known = (id: string) => id in LINE_TITLES;
  const order = [...new Set(strings(s.order))].filter(known);
  return { v: 1, order, hidden: strings(s.hidden).filter(known), open: strings(s.open).filter(known) };
}

// Lines that start open: the ones the person picked, plus the first
// urgent one so whatever's late is in front of them.
export function openAtStart(prefs: LinePrefs, tones: Partial<Record<LineId, LineTone>>): LineId[] {
  const visible = prefs.order.filter((id) => !prefs.hidden.includes(id));
  const urgent = visible.find((id) => tones[id] === "urgent");
  return visible.filter((id) => prefs.open.includes(id) || id === urgent);
}
