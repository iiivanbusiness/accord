"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Responsive, useContainerWidth, type Layout, type ResponsiveLayouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLS,
  DASHBOARD_MARGIN,
  DASHBOARD_ROW_HEIGHT,
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD,
  WIDGET_BY_ID,
  type Breakpoint,
  type GridItem,
  type SavedDashboard,
} from "@/lib/dashboard-widgets";

const toItems = (layout: Layout): GridItem[] => layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

// The dashboard's widgets on a grid each person arranges for themselves.
// "Customize" lets them drag widgets around, resize them from the corner,
// remove them, and add back hidden ones; "Done" saves it to their account.
// On a phone the widgets simply stack in the same order.
export default function DashboardGrid({
  widgets,
  saved,
  saveAction,
}: {
  widgets: Record<string, React.ReactNode>;
  saved: SavedDashboard;
  saveAction: (layout: SavedDashboard | null) => Promise<void>;
}) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [committed, setCommitted] = useState(saved);
  const [draft, setDraft] = useState<SavedDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // Item transitions only after the first paint, so the grid doesn't
  // visibly slide into place on load.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  const editing = draft !== null;
  const current = draft ?? committed;
  const stacked = mounted && width < DASHBOARD_BREAKPOINTS.md;
  const hidden = DASHBOARD_WIDGETS.filter((w) => !current.visible.includes(w.id) && widgets[w.id]);

  const layouts = useMemo(() => {
    const withMin = {} as ResponsiveLayouts<Breakpoint>;
    for (const bp of ["lg", "md"] as Breakpoint[]) {
      withMin[bp] = current.layouts[bp].map((it) => {
        const min = WIDGET_BY_ID.get(it.i)!.min;
        return { ...it, minW: Math.min(min.w, DASHBOARD_COLS[bp]), minH: min.h };
      });
    }
    return withMin;
  }, [current]);

  function update(fn: (d: SavedDashboard) => SavedDashboard) {
    setDraft((d) => (d ? fn(d) : d));
  }

  function remove(id: string) {
    update((d) => ({
      ...d,
      visible: d.visible.filter((v) => v !== id),
      layouts: { lg: d.layouts.lg.filter((it) => it.i !== id), md: d.layouts.md.filter((it) => it.i !== id) },
    }));
  }

  function add(id: string) {
    const def = WIDGET_BY_ID.get(id)!;
    update((d) => {
      const place = (bp: Breakpoint) => {
        const bottom = Math.max(0, ...d.layouts[bp].map((it) => it.y + it.h));
        return [...d.layouts[bp], { i: id, x: 0, y: bottom, ...def.size[bp] }];
      };
      return { ...d, visible: [...d.visible, id], layouts: { lg: place("lg"), md: place("md") } };
    });
  }

  function save(next: SavedDashboard | null) {
    setError(null);
    startSaving(async () => {
      try {
        await saveAction(next);
        setCommitted(next ?? DEFAULT_DASHBOARD);
        setDraft(null);
      } catch {
        setError("Couldn't save your layout. Try again.");
      }
    });
  }

  const ordered = [...current.layouts.lg].sort((a, b) => a.y - b.y || a.x - b.x).map((it) => it.i);

  const item = (id: string) => {
    const def = WIDGET_BY_ID.get(id);
    return (
      <div key={id} className={`dash-item @container ${editing ? "dash-editing" : ""}`}>
        {widgets[id]}
        {editing && (
          <>
            <div className="dash-drag" aria-hidden="true" />
            <button type="button" className="dash-remove" onClick={() => remove(id)} aria-label={`Remove ${def?.title ?? "widget"}`} title="Remove">
              ×
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      {!stacked && (
        <div className="mb-3 flex min-h-[34px] flex-wrap items-center justify-end gap-2">
          {editing ? (
            <>
              <span className="mr-auto text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                Drag a widget to move it, drag its corner to resize, × to remove.
              </span>
              <button type="button" disabled={saving} onClick={() => setDraft(DEFAULT_DASHBOARD)} className="btn btn-ghost btn-sm">
                Reset
              </button>
              <button type="button" disabled={saving} onClick={() => setDraft(null)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(JSON.stringify(draft) === JSON.stringify(DEFAULT_DASHBOARD) ? null : draft)}
                className="btn btn-primary btn-sm"
              >
                {saving ? "Saving…" : "Done"}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setDraft(committed)} className="btn btn-secondary btn-sm">
              Customize
            </button>
          )}
        </div>
      )}

      {editing && hidden.length > 0 && (
        <div className="dash-tray mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-dashed px-3 py-2.5" style={{ borderColor: "var(--hairline)" }}>
          <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Add
          </span>
          {hidden.map((w) => (
            <button key={w.id} type="button" onClick={() => add(w.id)} className="btn btn-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
              + {w.title}
            </button>
          ))}
        </div>
      )}
      {error && <div className="chip chip-warn mb-3 w-full justify-start px-4 py-2.5 text-[12.5px]">{error}</div>}

      <div ref={containerRef} className={`dash-grid ${animate ? "dash-ready" : ""} ${editing ? "is-editing" : ""}`} style={{ opacity: mounted ? 1 : 0 }}>
        {mounted &&
          (stacked ? (
            <div className="flex flex-col gap-4">
              {ordered.map((id, idx) => {
                // Stat tiles pair up two to a row, like before.
                if (id.startsWith("stat-")) {
                  if (idx > 0 && ordered[idx - 1].startsWith("stat-")) return null;
                  const run: string[] = [];
                  for (let j = idx; j < ordered.length && ordered[j].startsWith("stat-"); j++) run.push(ordered[j]);
                  return (
                    <div key={id} className="grid grid-cols-2 gap-4">
                      {run.map((sid) => (
                        <div key={sid} className="dash-item @container">{widgets[sid]}</div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div key={id} className="dash-item @container">
                    {widgets[id]}
                  </div>
                );
              })}
            </div>
          ) : (
            <Responsive
              width={width}
              layouts={layouts}
              breakpoints={DASHBOARD_BREAKPOINTS}
              cols={DASHBOARD_COLS}
              rowHeight={DASHBOARD_ROW_HEIGHT}
              margin={[DASHBOARD_MARGIN, DASHBOARD_MARGIN]}
              containerPadding={[0, 0]}
              dragConfig={{ enabled: editing, handle: ".dash-drag", cancel: ".dash-remove" }}
              resizeConfig={{ enabled: editing, handles: ["se"] }}
              onLayoutChange={(_layout: Layout, all: ResponsiveLayouts<Breakpoint>) => {
                if (!editing) return;
                update((d) => {
                  const next = { lg: all.lg ? toItems(all.lg) : d.layouts.lg, md: all.md ? toItems(all.md) : d.layouts.md };
                  // Same positions back: keep the same object so nothing re-renders.
                  return JSON.stringify(next) === JSON.stringify(d.layouts) ? d : { ...d, layouts: next };
                });
              }}
            >
              {current.visible.filter((id) => widgets[id]).map(item)}
            </Responsive>
          ))}
      </div>
    </div>
  );
}
