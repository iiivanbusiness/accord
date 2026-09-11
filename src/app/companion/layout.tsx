// Deliberately outside (app)/ — see companion/page.tsx's doc comment. The
// root layout (src/app/layout.tsx) still supplies fonts/theme-init; this
// just gives the floating panel its own sm-theme scope (colors are scoped
// to that class, not global — see globals.css) and a fixed, non-scrolling
// frame sized for a small always-on-top window instead of a full page.
export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sm-theme h-screen overflow-hidden" style={{ background: "var(--canvas)" }}>
      {children}
    </div>
  );
}
