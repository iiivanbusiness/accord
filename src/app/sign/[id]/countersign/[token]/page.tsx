import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";
import { signAsCountersigner, declineToSign } from "./actions";
import BrandLogo from "@/components/BrandLogo";
import CountersignForm from "@/components/CountersignForm";
import DeclineToSignForm from "@/components/DeclineToSignForm";

export default async function CountersignPage({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { deal: { include: { client: true, fields: true, workspace: true } }, template: true },
  });
  if (!contract || !contract.template) notFound();

  const signer = await prisma.contractSigner.findFirst({ where: { contractId: id, token } });
  if (!signer) notFound();

  const clauses = fillClauses(contract.template.clauses, contract.deal.fields);
  const decided = signer.status !== "pending";

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
        <div className="chip chip-neutral mb-6 px-4 py-3 text-[13.5px]">
          Signing as <strong>{signer.name}</strong> ({signer.role}). After <strong>{contract.deal.client.name}</strong>
        </div>

        {signer.status === "signed" && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="chip chip-success px-4 py-3 text-[13.5px]">
              ✓ You signed on {signer.signedAt?.toLocaleDateString()}
            </div>
            {signer.signatureImage && (
              <div className="card inline-block w-fit px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signer.signatureImage} alt={`${signer.name}'s signature`} style={{ height: 60 }} />
              </div>
            )}
          </div>
        )}
        {signer.status === "declined" && (
          <div className="chip chip-warn mb-6 px-4 py-3 text-[13.5px]">
            You declined to sign this agreement.
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
            </div>
          ))}
        </div>

        {!decided && (
          <div className="card mt-5 p-6">
            <h2 className="mb-1 text-[16px] font-medium">Review &amp; sign</h2>
            <p className="mb-4 text-[13px]" style={{ color: "var(--ink-muted)" }}>
              Draw your signature below and click Sign to complete this agreement.
            </p>
            <CountersignForm contractId={contract.id} token={token} signAction={signAsCountersigner} />

            <details className="mt-4">
              <summary className="cursor-pointer text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                I can&apos;t sign this
              </summary>
              <DeclineToSignForm contractId={contract.id} token={token} declineAction={declineToSign} />
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
