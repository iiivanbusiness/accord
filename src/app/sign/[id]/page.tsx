import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";
import { signContract, requestClauseChange } from "./actions";
import BrandLogo from "@/components/BrandLogo";
import SignaturePad from "@/components/SignaturePad";
import DownloadContractButton from "@/components/DownloadContractButton";

export default async function SignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ feedbackSent?: string }> }) {
  const { id } = await params;
  const { feedbackSent } = await searchParams;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { deal: { include: { client: true, fields: true, workspace: true } }, template: true, signers: { orderBy: { order: "asc" } } },
  });
  if (!contract || !contract.template) notFound();

  if (!contract.viewedAt) {
    await prisma.contract.update({ where: { id: contract.id }, data: { viewedAt: new Date() } });
  }

  const clauses = fillClauses(contract.template.clauses, contract.deal.fields);
  // The client is the only signer whose page this is — "signed" here means
  // the CLIENT'S OWN part is done, whether or not counter-signers still
  // need to act (partially_signed) or everyone's fully done (signed).
  const clientSigned = contract.status === "signed" || contract.status === "partially_signed";
  const expired = contract.status === "expired" || (contract.status === "sent" && contract.expiresAt != null && contract.expiresAt < new Date());

  return (
    <div className="sm-theme min-h-screen" style={{ background: "var(--canvas)" }}>
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-[720px] items-center gap-2.5">
          {contract.deal.workspace.logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contract.deal.workspace.logoImage} alt={contract.deal.workspace.name} style={{ height: 28, maxWidth: 160, objectFit: "contain" }} />
          ) : (
            <>
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] font-display text-[14px] font-semibold"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                S
              </div>
              <span className="text-[14px] font-medium">{contract.deal.workspace.name}</span>
            </>
          )}
          <span style={{ color: "var(--ink-muted)" }}>·</span>
          <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>via</span>
          <BrandLogo height={13} className="opacity-70" />
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-10">
        {feedbackSent && (
          <div className="chip chip-success mb-6 w-full justify-start px-4 py-3 text-[13.5px]">
            ✓ Thanks — your feedback was sent. We&apos;ll follow up.
          </div>
        )}
        {expired && (
          <div className="chip chip-warn mb-6 w-full justify-start px-4 py-3 text-[13.5px]">
            This sign link has expired — ask {contract.deal.workspace.name} to resend it.
          </div>
        )}
        {clientSigned && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="chip chip-success px-4 py-3 text-[13.5px]">
              ✓ Signed by {contract.signerName} on {contract.signedAt?.toLocaleDateString()}
            </div>
            {contract.signatureImage && (
              <div className="card inline-block w-fit px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contract.signatureImage} alt={`${contract.signerName}'s signature`} style={{ height: 60 }} />
              </div>
            )}
            {contract.status === "partially_signed" && contract.signers.length > 0 && (
              <div className="card px-4 py-3 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Waiting on {contract.signers.filter((s) => s.status === "pending").map((s) => `${s.name} (${s.role})`).join(", ")} before this is fully complete.
              </div>
            )}
          </div>
        )}

        <div className="card px-5 py-7 md:px-[46px] md:py-[42px]">
          <div className="mb-1.5 text-[22px] font-medium" style={{ letterSpacing: "-0.6px" }}>{contract.template.name}</div>
          <div className="mb-7 border-b pb-[22px] text-[13.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
            Between {contract.deal.workspace.name} and {contract.deal.client.name}
          </div>
          {clauses.map((clause, i) => (
            <div key={clause.title} className="mb-5 max-w-[64ch]">
              <h3 className="mb-1.5 flex gap-2 text-[14px] font-semibold">
                <span className="font-mono-tab font-normal" style={{ color: "var(--ink-muted)" }}>{i + 1}.</span>
                {clause.title}
              </h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{clause.body}</p>
              {!clientSigned && !expired && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[12px] font-medium" style={{ color: "var(--accent-blue)" }}>
                    Request a change to this clause
                  </summary>
                  <form action={requestClauseChange.bind(null, contract.id, clause.title)} className="mt-2.5 flex flex-col gap-2 rounded-[10px] p-3.5" style={{ background: "var(--surface-2)" }}>
                    <input name="fromName" placeholder="Your name (optional)" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
                    <textarea name="comment" required rows={2} placeholder="What would you like changed here?" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
                    <button type="submit" className="btn btn-secondary btn-sm w-fit">Send feedback</button>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>

        {!clientSigned && !expired ? (
          <div className="card mt-5 p-6">
            <h2 className="mb-1 text-[16px] font-medium">Review &amp; sign</h2>
            <p className="mb-4 text-[13px]" style={{ color: "var(--ink-muted)" }}>
              Draw your signature below and click Sign to complete this agreement.
            </p>
            <form action={signContract.bind(null, contract.id)} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Full name</span>
                <input name="signerName" required placeholder="Type your full name" className="input" />
              </label>
              <SignaturePad name="signatureImage" />
              <label className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                <input type="checkbox" required className="mt-0.5" />
                I have reviewed the agreement above and agree to its terms.
              </label>
              <button type="submit" className="btn btn-primary mt-1 w-full justify-center">
                Sign &amp; complete
              </button>
            </form>
          </div>
        ) : clientSigned ? (
          <div className="mt-5 text-center text-[12px]" style={{ color: "var(--ink-muted)" }}>
            This agreement was signed electronically on {contract.signedAt?.toLocaleString()}.
          </div>
        ) : null}

        <DownloadContractButton contractId={contract.id} className="btn btn-secondary mt-5 w-full justify-center" />
      </main>
    </div>
  );
}
