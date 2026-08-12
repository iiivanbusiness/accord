import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { sendToClient } from "../actions";

type Clause = { title: string; body: string };

function fillClauses(clausesJson: string, fields: { fieldKey: string; value: string | null }[]): Clause[] {
  const values = Object.fromEntries(fields.filter((f) => f.value).map((f) => [f.fieldKey, f.value as string]));
  const clauses = JSON.parse(clausesJson) as Clause[];
  return clauses.map((c) => ({
    title: c.title,
    body: c.body.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`),
  }));
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { client: true, template: true, fields: true, contract: true },
  });
  if (!deal || !deal.contract || !deal.template) notFound();

  const clauses = fillClauses(deal.template.clauses, deal.fields);

  return (
    <AppShell active="/deals" screenLabel="Contract review">
      <Link href={`/deals/${deal.id}`} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Deal
      </Link>

      <div className="mb-5">
        <h1 className="text-[25px] font-bold">Contract review</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Confirm the details before sending to your client
        </div>
      </div>

      {deal.contract.status !== "draft" && (
        <div
          className="mb-[18px] flex items-center gap-2.5 rounded-[14px] border px-4 py-3 text-[13.5px] font-semibold"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", borderColor: "rgba(79,227,190,.25)" }}
        >
          ✓ Sent to {deal.client.name} for signature
        </div>
      )}

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "1fr 300px" }}>
        <div
          className="rounded-[20px] px-[46px] py-[42px]"
          style={{ background: "linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.03))", border: "1px solid var(--glass-border)" }}
        >
          <div className="mb-1.5 text-[21px] font-bold">{deal.template.name}</div>
          <div className="mb-7 border-b pb-[22px] text-[13.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--glass-border-soft)" }}>
            Between Horizon Media and {deal.client.name}
          </div>
          {clauses.map((clause, i) => (
            <div key={clause.title} className="mb-5 max-w-[64ch]">
              <h3 className="mb-1.5 flex gap-2 text-[14px] font-bold">
                <span className="font-mono-tab font-normal" style={{ color: "var(--ink-faint)" }}>{i + 1}.</span>
                {clause.title}
              </h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{clause.body}</p>
            </div>
          ))}
        </div>

        <aside className="glass rounded-[20px]">
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--glass-border-soft)" }}>
            <h2 className="text-[15px] font-bold">Send</h2>
          </div>
          <div className="mx-5 my-3.5 flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold" style={{ borderColor: "var(--glass-border)", background: "rgba(255,255,255,.03)" }}>
            {deal.template.name}
          </div>
          <div className="flex flex-col gap-2.5 p-5 pt-2">
            {deal.contract.status === "draft" ? (
              <form action={sendToClient.bind(null, deal.id)}>
                <button
                  className="w-full rounded-full py-2.5 text-[13.5px] font-semibold"
                  style={{ background: "linear-gradient(160deg, var(--accent), var(--accent-strong))", color: "var(--accent-ink)" }}
                >
                  Send to client
                </button>
              </form>
            ) : (
              <button disabled className="w-full cursor-not-allowed rounded-full py-2.5 text-[13.5px] font-semibold" style={{ background: "var(--glass)", color: "var(--ink-faint)" }}>
                Sent ✓
              </button>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
