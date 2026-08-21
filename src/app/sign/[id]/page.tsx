import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";
import { signContract } from "./actions";
import BrandLogo from "@/components/BrandLogo";

export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { deal: { include: { client: true, fields: true } }, template: true },
  });
  if (!contract || !contract.template) notFound();

  const clauses = fillClauses(contract.template.clauses, contract.deal.fields);
  const signed = contract.status === "signed";

  return (
    <div className="sm-theme min-h-screen" style={{ background: "var(--canvas)" }}>
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-[720px] items-center gap-2.5">
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] font-display text-[14px] font-semibold"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            S
          </div>
          <span className="text-[14px] font-medium">Horizon Media</span>
          <span style={{ color: "var(--ink-muted)" }}>·</span>
          <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>via</span>
          <BrandLogo height={13} className="opacity-70" />
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-10">
        {signed && (
          <div className="chip chip-success mb-6 px-4 py-3 text-[13.5px]">
            ✓ Signed by {contract.signerName} on {contract.signedAt?.toLocaleDateString()}
          </div>
        )}

        <div className="card px-[46px] py-[42px]">
          <div className="mb-1.5 text-[22px] font-medium" style={{ letterSpacing: "-0.6px" }}>{contract.template.name}</div>
          <div className="mb-7 border-b pb-[22px] text-[13.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
            Between Horizon Media and {contract.deal.client.name}
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

        {!signed ? (
          <div className="card mt-5 p-6">
            <h2 className="mb-1 text-[16px] font-medium">Review &amp; sign</h2>
            <p className="mb-4 text-[13px]" style={{ color: "var(--ink-muted)" }}>
              Typing your name below and clicking Sign counts as your electronic signature on this agreement.
            </p>
            <form action={signContract.bind(null, contract.id)} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Full name</span>
                <input name="signerName" required placeholder="Type your full name" className="input" />
              </label>
              <label className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                <input type="checkbox" required className="mt-0.5" />
                I have reviewed the agreement above and agree to its terms.
              </label>
              <button type="submit" className="btn btn-primary mt-1 w-full justify-center">
                Sign &amp; complete
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-5 text-center text-[12px]" style={{ color: "var(--ink-muted)" }}>
            This agreement was signed electronically on {contract.signedAt?.toLocaleString()}.
          </div>
        )}

        <a href={`/api/contracts/${contract.id}/pdf`} className="btn btn-secondary mt-5 w-full justify-center">
          Download PDF
        </a>
      </main>
    </div>
  );
}
