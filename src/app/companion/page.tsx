import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import CompanionPanel from "@/components/CompanionPanel";

// The floating companion window's page — deliberately NOT under (app)/, so
// it never picks up AppShell's sidebar/header chrome (a 340×520 panel has
// no room for that). Because of that, it has to do its own auth guard:
// (app)/layout.tsx does none itself — AppShell is what calls
// requireWorkspace() — and there's no src/middleware.ts covering this
// either, so skipping this call would serve the panel with no auth at all.
export default async function CompanionPage() {
  const workspace = await requireWorkspace();

  // Same query shape as the Dashboard's "Upcoming calls" widget — next 5,
  // not bounded to today specifically, so the panel isn't empty right after
  // the last event of the day passes.
  const upcomingEvents = await prisma.calendarEvent.findMany({
    where: { workspaceId: workspace.id, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    take: 5,
    select: { id: true, title: true, clientName: true, startTime: true, durationMinutes: true, platform: true, meetingUrl: true, linkedDealId: true },
  });

  return (
    <CompanionPanel
      upcomingEvents={upcomingEvents.map((e) => ({ ...e, startTime: e.startTime.toISOString() }))}
      fastPoll={Boolean(process.env.DEMO_FAST_EXTRACTION)}
    />
  );
}
