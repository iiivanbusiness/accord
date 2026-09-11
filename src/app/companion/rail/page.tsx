import { requireWorkspace } from "@/lib/workspace";
import CompanionRail from "@/components/CompanionRail";

// The persistent icon rail's own route — a sibling to /companion, not a
// child view of it (that page is content-only now, shown/hidden
// independently — see desktop-app's select_companion_view). Same auth-guard
// reasoning as src/app/companion/page.tsx: this is outside (app)/ so
// AppShell never runs, and there's no src/middleware.ts covering it either.
// Inherits the transparent, non-scrolling frame from
// src/app/companion/layout.tsx as a child route.
export default async function CompanionRailPage() {
  await requireWorkspace();
  return <CompanionRail />;
}
