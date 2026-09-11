// Deliberately outside (app)/ — see companion/page.tsx's doc comment. The
// root layout (src/app/layout.tsx) still supplies fonts/theme-init; this
// just gives the floating panel a fixed frame with NO painted background —
// the window itself is transparent with a native macOS vibrancy blur behind
// it (see desktop-app/src-tauri/src/lib.rs, build_companion_window), so any
// opaque background here would hide that blur entirely. Not using the main
// app's .sm-theme light/dark system on purpose — a floating glass panel
// reads as one fixed dark-glass surface regardless of the app's own theme,
// the same way a macOS widget doesn't follow a specific app's light/dark
// setting.
export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* globals.css sets `body { background: var(--canvas) }` unscoped —
          this route needs body itself transparent, not just this div, or
          that paints over the native blur underneath everything. Only
          present in the DOM while this route is mounted. */}
      <style>{"html, body { background: transparent !important; }"}</style>
      <div style={{ height: "100vh", overflow: "hidden", background: "transparent" }}>
        {children}
      </div>
    </>
  );
}
