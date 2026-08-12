import Link from "next/link";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { createDeal } from "./actions";

function Field({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <input name={name} placeholder={placeholder} required={required} className="input" />
    </label>
  );
}

export default async function NewDealPage() {
  const templates = await prisma.contractTemplate.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell active="/deals" screenLabel="Upload a call">
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="mb-6 max-w-[520px]">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Upload a call</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Real transcription and extraction come with the Zoom integration — for now, enter what the call covered and it&apos;ll drop straight into the same review flow.
        </div>
      </div>

      <form action={createDeal} className="card flex max-w-[520px] flex-col gap-4 p-6">
        <Field label="Client name" name="clientName" placeholder="Acme Fitness" required />
        <Field label="Company" name="company" placeholder="Same as client name if blank" />
        <Field label="Client email" name="email" placeholder="hello@client.com" />
        <Field label="Service" name="service" placeholder="Social Media Management" required />
        <Field label="Fee" name="feeDisplay" placeholder="€2,500 / month" required />

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Template</span>
          <select name="templateId" className="input">
            {templates.map((t) => (
              <option key={t.id} value={t.id} style={{ background: "var(--surface-1)" }}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
          Start processing
        </button>
      </form>
    </AppShell>
  );
}
