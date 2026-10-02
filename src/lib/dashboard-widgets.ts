// The dashboard's widgets and their default layout. Each person can show,
// hide, move and resize them (DashboardGrid); what they pick is saved on
// User.dashboardLayout in the SavedDashboard shape below.

export type Breakpoint = "lg" | "md";
export type GridItem = { i: string; x: number; y: number; w: number; h: number };
export type SavedDashboard = { version: 1; visible: string[]; layouts: Record<Breakpoint, GridItem[]> };

// lg: 12 columns, from 960px of content width. md: 6 columns, from 640px.
// Narrower than that the widgets stack in the lg order.
export const DASHBOARD_COLS: Record<Breakpoint, number> = { lg: 12, md: 6 };
export const DASHBOARD_BREAKPOINTS: Record<Breakpoint, number> = { lg: 960, md: 640 };
// Small rows so resizing moves in fine steps (one row = 26px with the margin).
export const DASHBOARD_ROW_HEIGHT = 10;
export const DASHBOARD_MARGIN = 16;

type WidgetDef = { id: string; title: string; min: { w: number; h: number }; size: Record<Breakpoint, { w: number; h: number }> };

export const DASHBOARD_WIDGETS: WidgetDef[] = [
  { id: "stat-value", title: "Combined deal value", min: { w: 2, h: 6 }, size: { lg: { w: 2, h: 7 }, md: { w: 2, h: 7 } } },
  { id: "stat-active", title: "Active deals", min: { w: 2, h: 6 }, size: { lg: { w: 2, h: 7 }, md: { w: 2, h: 7 } } },
  { id: "stat-signed", title: "Contracts signed", min: { w: 2, h: 6 }, size: { lg: { w: 2, h: 7 }, md: { w: 2, h: 7 } } },
  { id: "stat-clients", title: "Clients", min: { w: 2, h: 6 }, size: { lg: { w: 2, h: 7 }, md: { w: 2, h: 7 } } },
  { id: "stat-renewals", title: "Renewals at risk", min: { w: 2, h: 6 }, size: { lg: { w: 2, h: 7 }, md: { w: 2, h: 7 } } },
  { id: "stat-stuck", title: "Stuck deals count", min: { w: 2, h: 6 }, size: { lg: { w: 2, h: 7 }, md: { w: 2, h: 7 } } },
  { id: "status-folders", title: "Deals by status", min: { w: 3, h: 8 }, size: { lg: { w: 12, h: 9 }, md: { w: 6, h: 14 } } },
  { id: "deal-value", title: "Deal value by month", min: { w: 4, h: 12 }, size: { lg: { w: 7, h: 14 }, md: { w: 6, h: 14 } } },
  { id: "upcoming-calls", title: "Upcoming calls", min: { w: 3, h: 9 }, size: { lg: { w: 5, h: 14 }, md: { w: 6, h: 12 } } },
  { id: "upcoming-renewals", title: "Upcoming renewals", min: { w: 3, h: 9 }, size: { lg: { w: 4, h: 14 }, md: { w: 3, h: 14 } } },
  { id: "stuck-deals", title: "Stuck deals", min: { w: 3, h: 9 }, size: { lg: { w: 4, h: 14 }, md: { w: 3, h: 14 } } },
  { id: "this-month", title: "This month", min: { w: 2, h: 9 }, size: { lg: { w: 4, h: 14 }, md: { w: 6, h: 10 } } },
  { id: "recent-deals", title: "Recent deals", min: { w: 4, h: 10 }, size: { lg: { w: 12, h: 19 }, md: { w: 6, h: 19 } } },
];

export const WIDGET_BY_ID = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w]));

const at = (i: string, x: number, y: number, bp: Breakpoint): GridItem => ({ i, x, y, ...WIDGET_BY_ID.get(i)!.size[bp] });

// Same arrangement the dashboard had before it was customizable.
export const DEFAULT_DASHBOARD: SavedDashboard = {
  version: 1,
  visible: DASHBOARD_WIDGETS.map((w) => w.id),
  layouts: {
    lg: [
      at("stat-value", 0, 0, "lg"),
      at("stat-active", 2, 0, "lg"),
      at("stat-signed", 4, 0, "lg"),
      at("stat-clients", 6, 0, "lg"),
      at("stat-renewals", 8, 0, "lg"),
      at("stat-stuck", 10, 0, "lg"),
      at("status-folders", 0, 7, "lg"),
      at("deal-value", 0, 16, "lg"),
      at("upcoming-calls", 7, 16, "lg"),
      at("upcoming-renewals", 0, 30, "lg"),
      at("stuck-deals", 4, 30, "lg"),
      at("this-month", 8, 30, "lg"),
      at("recent-deals", 0, 44, "lg"),
    ],
    md: [
      at("stat-value", 0, 0, "md"),
      at("stat-active", 2, 0, "md"),
      at("stat-signed", 4, 0, "md"),
      at("stat-clients", 0, 7, "md"),
      at("stat-renewals", 2, 7, "md"),
      at("stat-stuck", 4, 7, "md"),
      at("status-folders", 0, 14, "md"),
      at("deal-value", 0, 28, "md"),
      at("upcoming-calls", 0, 42, "md"),
      at("upcoming-renewals", 0, 54, "md"),
      at("stuck-deals", 3, 54, "md"),
      at("this-month", 0, 68, "md"),
      at("recent-deals", 0, 78, "md"),
    ],
  },
};

const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);

// Accepts only known widgets with sane positions, so a stale or tampered
// layout can't break the page; anything it can't use falls back to the
// default for that widget.
export function normalizeDashboard(raw: unknown): SavedDashboard {
  const value = raw as Partial<SavedDashboard> | null;
  if (!value || value.version !== 1 || !Array.isArray(value.visible) || typeof value.layouts !== "object" || !value.layouts) return DEFAULT_DASHBOARD;
  const visible = [...new Set(value.visible.filter((id): id is string => typeof id === "string" && WIDGET_BY_ID.has(id)))];
  const layouts = {} as Record<Breakpoint, GridItem[]>;
  for (const bp of ["lg", "md"] as Breakpoint[]) {
    const cols = DASHBOARD_COLS[bp];
    const items = Array.isArray(value.layouts[bp]) ? value.layouts[bp] : [];
    const byId = new Map<string, GridItem>();
    for (const item of items as Partial<GridItem>[]) {
      const def = item && typeof item.i === "string" ? WIDGET_BY_ID.get(item.i) : undefined;
      if (!def || !visible.includes(def.id) || byId.has(def.id)) continue;
      const w = Math.min(cols, Math.max(Math.min(def.min.w, cols), int(item.w)));
      const h = Math.min(120, Math.max(def.min.h, int(item.h)));
      const x = Math.min(cols - w, Math.max(0, int(item.x)));
      const y = Math.min(2000, Math.max(0, int(item.y)));
      if ([w, h, x, y].some(Number.isNaN)) continue;
      byId.set(def.id, { i: def.id, x, y, w, h });
    }
    // A visible widget with no position here goes at the bottom.
    let bottom = Math.max(0, ...[...byId.values()].map((it) => it.y + it.h));
    for (const id of visible) {
      if (byId.has(id)) continue;
      const size = WIDGET_BY_ID.get(id)!.size[bp];
      byId.set(id, { i: id, x: 0, y: bottom, ...size });
      bottom += size.h;
    }
    layouts[bp] = visible.map((id) => byId.get(id)!);
  }
  return { version: 1, visible, layouts };
}
