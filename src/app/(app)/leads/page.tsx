import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { currentUserWithRole } from "@/lib/permissions";
import { leadAccess } from "@/lib/lead-visibility";
import { isLeadStage, LEAD_INTEREST_LABEL, LEAD_STAGE_CHIP, LEAD_STAGE_LABEL } from "@/lib/lead-stages";
import { formatPhone } from "@/lib/phone";
import LeadsFilterBar from "@/components/LeadsFilterBar";
import LeadsTable from "@/components/LeadsTable";
import { assignLeadTasks } from "./task-actions";

const TABS = [
  { key: "", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
] as const;

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Next-step dates are stored as UTC midnight (see leads/actions.ts), so
// formatting in UTC shows the day that was picked, for every viewer.
function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; stage?: string; owner?: string }>;
}) {
  const workspace = await requireProspecting();
  const user = await currentUserWithRole();
  const access = await leadAccess(user);
  const params = await searchParams;
  // A rep only ever sees their own leads, so the tabs and owner filter are
  // a manager's view.
  const tab = access.canViewAll ? (params.tab ?? "") : "";
  const { q, stage, owner } = params;

  // AND, not a spread: the visibility rule and the search are both ORs.
  const where = {
    workspaceId: workspace.id,
    AND: [
      access.where,
      tab === "mine" ? { ownerId: user.id } : tab === "unassigned" ? { ownerId: null } : {},
      stage && isLeadStage(stage) ? { stage } : {},
      owner && tab === "" ? { ownerId: owner } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q.replace(/[^\d+]/g, "") || q } },
            ],
          }
        : {},
    ],
  };

  const [leads, members, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: {
        id: true,
        name: true,
        title: true,
        company: true,
        email: true,
        phone: true,
        stage: true,
        interest: true,
        nextStep: true,
        nextStepAt: true,
        updatedAt: true,
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    access.canViewAll || access.canAssign
      ? prisma.user.findMany({ where: { workspaceId: workspace.id, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.lead.count({ where: { workspaceId: workspace.id, ...access.where } }),
  ]);

  const tabHref = (key: string) => (key ? `/leads?tab=${key}` : "/leads");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Leads</h1>
          <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
            {total.toLocaleString("en-US")} {total === 1 ? "lead" : "leads"}. {access.canViewAll ? "Prospects you call before they become deals" : "Your prospects, before they become deals"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/leads/import" className="btn btn-secondary">
            Import
          </Link>
          <Link href="/leads/new" className="btn btn-primary">
            + Add lead
          </Link>
        </div>
      </div>

      {access.canViewAll && (
      <div className="mb-3.5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className="btn btn-sm"
            style={tab === t.key ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      )}

      <LeadsFilterBar owners={access.canViewAll ? members : []} showOwnerFilter={access.canViewAll && tab === ""} />

      {leads.length === 0 ? (
        <div className="card flex flex-col items-start gap-3 p-6">
          <div className="text-[14.5px] font-medium">{total === 0 ? "No leads yet" : "No leads match"}</div>
          <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
            {total === 0 ? "Add your first lead by hand, or bring in a list from a spreadsheet or CSV." : "Try a different search or clear the filters."}
          </div>
          {total === 0 && (
            <div className="flex flex-wrap gap-2">
              <Link href="/leads/new" className="btn btn-primary btn-sm">
                + Add lead
              </Link>
              <Link href="/leads/import" className="btn btn-secondary btn-sm">
                Import a list
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <LeadsTable
            showOwner={access.canViewAll}
            canAssign={access.canAssign}
            assignees={access.canAssign ? members : []}
            assignAction={assignLeadTasks}
            rows={leads.map((lead) => {
              const next = [lead.nextStepAt ? formatDay(lead.nextStepAt) : null, lead.nextStep].filter(Boolean).join(" · ");
              return {
                id: lead.id,
                name: lead.name,
                subtitle: [lead.title, lead.company].filter(Boolean).join(" · ") || lead.email || formatPhone(lead.phone) || "",
                secondary: lead.title || lead.email || formatPhone(lead.phone) || "",
                company: lead.company,
                stageLabel: LEAD_STAGE_LABEL[lead.stage] ?? lead.stage,
                stageChip: LEAD_STAGE_CHIP[lead.stage] ?? "chip-neutral",
                interest: lead.interest ? LEAD_INTEREST_LABEL[lead.interest] : "-",
                owner: lead.owner?.name ?? "Unassigned",
                next,
                updated: timeAgo(lead.updatedAt),
              };
            })}
          />
          {leads.length === 500 && (
            <div className="mt-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>Showing the 500 most recently updated. Search or filter to narrow it down.</div>
          )}
        </>
      )}
    </>
  );
}
