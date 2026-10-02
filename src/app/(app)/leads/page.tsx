import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { currentUserWithRole } from "@/lib/permissions";
import { isLeadStage, LEAD_INTEREST_LABEL, LEAD_STAGE_CHIP, LEAD_STAGE_LABEL } from "@/lib/lead-stages";
import { formatPhone } from "@/lib/phone";
import LeadsFilterBar from "@/components/LeadsFilterBar";

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

// Columns drop out as the window narrows so the table never runs past the
// card; below md the list switches to stacked rows instead.
const SHOW = {
  company: "hidden lg:table-cell",
  owner: "hidden 2xl:table-cell",
  next: "hidden xl:table-cell",
  updated: "hidden 2xl:table-cell",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; stage?: string; owner?: string }>;
}) {
  const workspace = await requireProspecting();
  const user = await currentUserWithRole();
  const { tab = "", q, stage, owner } = await searchParams;

  const where = {
    workspaceId: workspace.id,
    ...(tab === "mine" ? { ownerId: user.id } : tab === "unassigned" ? { ownerId: null } : {}),
    ...(stage && isLeadStage(stage) ? { stage } : {}),
    ...(owner && tab === "" ? { ownerId: owner } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { company: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q.replace(/[^\d+]/g, "") || q } },
          ],
        }
      : {}),
  };

  const [leads, owners, total] = await Promise.all([
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
    prisma.user.findMany({ where: { workspaceId: workspace.id, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.count({ where: { workspaceId: workspace.id } }),
  ]);

  const tabHref = (key: string) => (key ? `/leads?tab=${key}` : "/leads");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Leads</h1>
          <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
            {total} {total === 1 ? "lead" : "leads"}. Prospects you call before they become deals
          </div>
        </div>
        <Link href="/leads/new" className="btn btn-primary">
          + Add lead
        </Link>
      </div>

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

      <LeadsFilterBar owners={owners} showOwnerFilter={tab === ""} />

      {leads.length === 0 ? (
        <div className="card flex flex-col items-start gap-3 p-6">
          <div className="text-[14.5px] font-medium">{total === 0 ? "No leads yet" : "No leads match"}</div>
          <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
            {total === 0 ? "Add your first lead by hand. Importing from a file or your CRM is coming next." : "Try a different search or clear the filters."}
          </div>
          {total === 0 && (
            <Link href="/leads/new" className="btn btn-primary btn-sm">
              + Add lead
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Phone: stacked rows */}
          <div className="card divide-y overflow-hidden md:hidden" style={{ borderColor: "var(--hairline)" }}>
            {leads.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="row-hover flex flex-col gap-1.5 px-4 py-3.5" style={{ borderColor: "var(--hairline-soft)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium" style={{ color: "var(--ink)" }}>{lead.name}</div>
                    <div className="truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                      {[lead.title, lead.company].filter(Boolean).join(" · ") || lead.email || formatPhone(lead.phone) || "No details yet"}
                    </div>
                  </div>
                  <span className={`chip flex-none ${LEAD_STAGE_CHIP[lead.stage] ?? "chip-neutral"}`}>{LEAD_STAGE_LABEL[lead.stage] ?? lead.stage}</span>
                </div>
                {(lead.nextStep || lead.nextStepAt) && (
                  <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>
                    Next: {[lead.nextStepAt ? formatDay(lead.nextStepAt) : null, lead.nextStep].filter(Boolean).join(" · ")}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Computer: table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      { label: "Lead", show: "" },
                      { label: "Company", show: SHOW.company },
                      { label: "Stage", show: "" },
                      { label: "Interest", show: "" },
                      { label: "Owner", show: SHOW.owner },
                      { label: "Next step", show: SHOW.next },
                      { label: "Updated", show: SHOW.updated },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`whitespace-nowrap border-b px-4 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide ${col.show}`}
                        style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const cell = "border-b px-4 py-3 text-[13px]";
                    const border = { borderColor: "var(--hairline-soft)" };
                    const muted = { ...border, color: "var(--ink-muted)" };
                    return (
                      <tr key={lead.id} className="row-hover transition-colors">
                        <td className={cell} style={border}>
                          <Link href={`/leads/${lead.id}`} className="block max-w-[200px]">
                            <div className="truncate font-medium" style={{ color: "var(--ink)" }} title={lead.name}>{lead.name}</div>
                            <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>
                              {lead.title || lead.email || formatPhone(lead.phone) || " "}
                            </div>
                          </Link>
                        </td>
                        <td className={`${cell} ${SHOW.company}`} style={muted}>
                          <div className="max-w-[160px] truncate" title={lead.company ?? undefined}>{lead.company ?? "-"}</div>
                        </td>
                        <td className={cell} style={border}>
                          <span className={`chip whitespace-nowrap ${LEAD_STAGE_CHIP[lead.stage] ?? "chip-neutral"}`}>{LEAD_STAGE_LABEL[lead.stage] ?? lead.stage}</span>
                        </td>
                        <td className={`whitespace-nowrap ${cell}`} style={muted}>{lead.interest ? LEAD_INTEREST_LABEL[lead.interest] : "-"}</td>
                        <td className={`${cell} ${SHOW.owner}`} style={muted}>
                          <div className="max-w-[120px] truncate">{lead.owner?.name ?? "Unassigned"}</div>
                        </td>
                        <td className={`${cell} ${SHOW.next}`} style={muted}>
                          <div className="max-w-[180px] truncate" title={lead.nextStep ?? undefined}>
                            {[lead.nextStepAt ? formatDay(lead.nextStepAt) : null, lead.nextStep].filter(Boolean).join(" · ") || "-"}
                          </div>
                        </td>
                        <td className={`whitespace-nowrap ${cell} ${SHOW.updated}`} style={muted}>{timeAgo(lead.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {leads.length === 500 && (
            <div className="mt-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>Showing the 500 most recently updated. Search or filter to narrow it down.</div>
          )}
        </>
      )}
    </>
  );
}
