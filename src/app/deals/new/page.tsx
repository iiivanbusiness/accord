import Link from "next/link";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { createDeal } from "./actions";

function Field({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="rounded-[9px] border px-3 py-2.5 text-[13.5px]"
        style={{ borderColor: "var(--glass-border)", background: "rgba(255,255,255,.04)", color: "var(--ink)" }}
      />
    </label>
  );
}

export default async function NewDealPage() {
  const templates = await prisma.contractTemplate.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell active="/deals" screenLabel="Upload a call">
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="mb-6 max-w-[520px]">
        <h1 className="text-[25px] font-bold">Upload a call</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Real transcription and extraction come with the Zoom integration — for now, enter what the call covered and it'll drop straight into the same review flow.
        </div>
      </div>

      <form action={createDeal} className="glass flex max-w-[520px] flex-col gap-4 rounded-[20px] p-6">
        <Field label="Client name" name="clientName" placeholder="Acme Fitness" required />
        <Field label="Company" name="company" placeholder="Same as client name if blank" />
        <Field label="Client email" name="email" placeholder="hello@client.com" />
        <Field label="Service" name="service" placeholder="Social Media Management" required />
        <Field label="Fee" name="feeDisplay" placeholder="€2,500 / month" required />

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Template</span>
          <select
            name="templateId"
            className="rounded-[9px] border px-3 py-2.5 text-[13.5px]"
            style={{ borderColor: "var(--glass-border)", background: "rgba(255,255,255,.04)", color: "var(--ink)" }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id} style={{ background: "#12161A" }}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="mt-2 w-full rounded-full py-2.5 text-[13.5px] font-semibold"
          style={{ background: "linear-gradient(160deg, var(--accent), var(--accent-strong))", color: "var(--accent-ink)" }}
        >
          Start processing
        </button>
      </form>
    </AppShell>
  );
}
