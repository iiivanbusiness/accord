import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";
import { requireWorkspaceId } from "@/lib/workspace";
import { currentUserWithRole } from "@/lib/permissions";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import DownloadContractButton from "@/components/DownloadContractButton";
import AuditTrailButton from "@/components/AuditTrailButton";
import ApprovalStepper from "@/components/ApprovalStepper";
import { decideApproval } from "../approval-actions";
import { startRenewal } from "../actions";

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await requireWorkspaceId();
  const currentUser = await currentUserWithRole();
  const { where: visibility } = await dealVisibilityFilter(currentUser);
  const deal = await prisma.deal.findFirst({
    where: { id, workspaceId, ...visibility },
    include: {
      client: true,
      template: true,
      fields: true,
      contract: {
        include: {
          approvals: { include: { role: true, decidedByUser: true }, orderBy: { order: "asc" } },
          clauseComments: { where: { resolved: false }, orderBy: { createdAt: "asc" } },
        },
      },
      workspace: true,
    },
  });
  if (!deal || !deal.contract || !deal.template) notFound();

  const clauses = fillClauses(deal.template.clauses, deal.fields);
  const showApprovalStepper = deal.contract.approvals.length > 0 && (deal.contract.status === "pending_approval" || deal.contract.status === "changes_requested");
  const canResend = deal.contract.status === "draft" || deal.contract.status === "changes_requested";
  const commentsByClause = new Map<string, typeof deal.contract.clauseComments>();
  for (const comment of deal.contract.clauseComments) {
    if (!commentsByClause.has(comment.clauseTitle)) commentsByClause.set(comment.clauseTitle, []);
    commentsByClause.get(comment.clauseTitle)!.push(comment);
  }

  return (
    <>
    <Link href={`/deals/${deal.id}`} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
      ← Deal
    </Link>

    <div className="mb-5">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Contract review</h1>
      <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        Confirm the details before sending to your client
      </div>
    </div>

    {deal.contract.status === "signed" && (
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <div className="chip chip-success px-4 py-3 text-[13.5px]">
          ✓ Signed by {deal.contract.signerName} on {deal.contract.signedAt?.toLocaleDateString()}
        </div>
        {deal.contract.signatureImage && (
          <div className="card px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={deal.contract.signatureImage} alt={`${deal.contract.signerName}'s signature`} style={{ height: 40 }} />
          </div>
        )}
      </div>
    )}
    {deal.contract.status === "pending_approval" && (
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <div className="chip chip-neutral px-4 py-3 text-[13.5px]">
          Waiting on approval before this goes to {deal.client.name}
        </div>
      </div>
    )}
    {deal.contract.status === "changes_requested" && (
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <div className="chip chip-warn px-4 py-3 text-[13.5px]">
          Changes requested — make edits, then send again
        </div>
      </div>
    )}
    {deal.contract.status === "sent" && (
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <div className="chip chip-warn px-4 py-3 text-[13.5px]">
          ✓ Sent to {deal.client.name} — awaiting signature
        </div>
        {deal.contract.viewedAt && (
          <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            👁 Viewed {timeAgo(deal.contract.viewedAt)}
          </span>
        )}
      </div>
    )}

    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_300px]">
      <div className="card px-5 py-7 md:px-[46px] md:py-[42px]">
        <div className="mb-1.5 text-[21px] font-medium" style={{ letterSpacing: "-0.6px" }}>{deal.template.name}</div>
        <div className="mb-7 border-b pb-[22px] text-[13.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
          Between {deal.workspace.name} and {deal.client.name}
        </div>
        {clauses.map((clause, i) => (
          <div key={clause.title} className="mb-5 max-w-[64ch]">
            <h3 className="mb-1.5 flex gap-2 text-[14px] font-semibold">
              <span className="font-mono-tab font-normal" style={{ color: "var(--ink-muted)" }}>{i + 1}.</span>
              {clause.title}
            </h3>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{clause.body}</p>
            {commentsByClause.get(clause.title)?.map((comment) => (
              <div key={comment.id} className="mt-2 rounded-[8px] px-3 py-2.5 text-[12.5px]" style={{ background: "var(--warn-soft)", color: "var(--ink)" }}>
                <span className="font-medium">{comment.fromName}:</span> {comment.comment}
              </div>
            ))}
          </div>
        ))}
      </div>

      <aside className="card">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Send</h2>
        </div>
        <div className="mx-5 my-3.5 flex items-center justify-between rounded-[10px] px-3 py-2.5 text-[13px] font-medium" style={{ border: "1px solid var(--hairline)", background: "var(--canvas)" }}>
          {deal.template.name}
        </div>
        <div className="flex flex-col gap-2.5 p-5 pt-2">
          {canResend ? (
            <Link href={`/deals/${deal.id}/send`} className="btn btn-primary w-full justify-center">
              {deal.contract.status === "changes_requested" ? "Send again" : "Send to client"}
            </Link>
          ) : deal.contract.status === "pending_approval" ? (
            <button disabled className="btn btn-primary w-full justify-center">
              Awaiting approval
            </button>
          ) : (
            <>
              <button disabled className="btn btn-primary w-full justify-center">
                {deal.contract.status === "signed" ? "Signed ✓" : "Sent ✓"}
              </button>
              <div className="rounded-[10px] px-3 py-2.5 text-[11.5px] break-all" style={{ border: "1px solid var(--hairline)", background: "var(--canvas)", color: "var(--ink-muted)" }}>
                {`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign/${deal.contract.id}`}
              </div>
            </>
          )}
          <DownloadContractButton contractId={deal.contract.id} className="btn btn-secondary w-full justify-center" />
          {Boolean(currentUser.role?.canManageWorkspace) && (
            <AuditTrailButton dealId={deal.id} className="btn btn-secondary w-full justify-center" />
          )}
        </div>
      </aside>
    </div>

    {deal.contract.status === "signed" && deal.contract.renewalDate && (
      <div className="card mt-[18px] max-w-[600px]">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Renewal</h2>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-medium">
                {deal.contract.autoRenews ? "Auto-renews" : "Term ends"} {deal.contract.renewalDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </div>
              {deal.contract.renewalNote && (
                <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{deal.contract.renewalNote}</div>
              )}
            </div>
            <span className={`chip flex-none ${daysUntil(deal.contract.renewalDate) <= 30 ? "chip-warn" : "chip-neutral"}`} style={{ fontSize: 11 }}>
              {daysUntil(deal.contract.renewalDate) > 0 ? `${daysUntil(deal.contract.renewalDate)}d left` : "Past due"}
            </span>
          </div>
          <form action={startRenewal.bind(null, deal.id)}>
            <button type="submit" className="btn btn-secondary w-full justify-center">
              Start renewal
            </button>
          </form>
        </div>
      </div>
    )}

    {showApprovalStepper && (
      <div className="mt-[18px] max-w-[600px]">
        <ApprovalStepper
          dealId={deal.id}
          approvals={deal.contract.approvals.map((a) => ({
            id: a.id,
            order: a.order,
            status: a.status,
            roleId: a.roleId,
            roleName: a.role.name,
            decidedByName: a.decidedByUser?.name ?? null,
            decidedAt: a.decidedAt,
            note: a.note,
          }))}
          currentUserRoleId={currentUser.roleId}
          currentUserCanApprove={Boolean(currentUser.role?.canApproveContracts)}
          decideAction={decideApproval}
        />
      </div>
    )}
    </>
  );
}
