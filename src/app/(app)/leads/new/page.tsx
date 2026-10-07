import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { currentUserWithRole } from "@/lib/permissions";
import { leadAccess } from "@/lib/lead-visibility";
import LeadFields from "@/components/LeadFields";
import { workspaceCampaigns } from "@/lib/campaigns";
import SubmitButton from "@/components/SubmitButton";
import { createLead } from "../actions";

export default async function NewLeadPage() {
  const workspace = await requireProspecting();
  const user = await currentUserWithRole();
  const access = await leadAccess(user);
  const owners = access.canAssign
    ? await prisma.user.findMany({ where: { workspaceId: workspace.id, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [{ id: user.id, name: user.name }];
  const campaigns = await workspaceCampaigns(workspace.id);

  return (
    <>
      <Link href="/leads" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Leads
      </Link>
      <div className="mb-5">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Add a lead</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Just the basics. Everything else fills in after your first call.
        </div>
      </div>
      <form action={createLead} className="card flex max-w-[640px] flex-col gap-5 p-5 sm:p-6">
        <LeadFields owners={owners} values={{ ownerId: user.id }} allowUnassigned={access.canAssign} campaigns={campaigns} />
        <SubmitButton className="btn btn-primary w-full justify-center sm:w-auto sm:self-start" pendingText="Adding…">
          Add lead
        </SubmitButton>
      </form>
    </>
  );
}
