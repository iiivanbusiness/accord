"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ConvertInput } from "@/app/(app)/leads/convert-actions";

// "Convert to deal" on a lead: a short form for what the deal needs that
// the lead doesn't have yet (what they're buying, the fee, the template).
export default function ConvertLeadButton({
  defaults,
  templates,
  convertAction,
}: {
  defaults: { clientName: string; company: string; email: string };
  templates: { id: string; name: string }[];
  convertAction: (input: ConvertInput) => Promise<{ error: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ConvertInput>({ ...defaults, service: "", fee: "", templateId: templates.length === 1 ? templates[0].id : "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof ConvertInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.templateId) return setError("Pick a contract template.");
    startTransition(async () => {
      // On success the action redirects to the new deal; it only returns
      // when something needs fixing.
      const result = await convertAction(form);
      if (result?.error) setError(`${result.error}.`);
    });
  }

  const field = (label: string, input: React.ReactNode, wide?: boolean) => (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>{label}</span>
      {input}
    </label>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        Convert to deal
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onMouseDown={(e) => e.target === e.currentTarget && !pending && setOpen(false)}>
          <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Convert to deal" className="card flex max-h-[92dvh] w-full max-w-[540px] flex-col gap-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[var(--r-lg)] sm:p-6">
            <div>
              <h2 className="text-[16px] font-medium">Convert to deal</h2>
              <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                Makes a client and a deal you can send a contract from. This lead&apos;s calls and notes go with it.
              </div>
            </div>
            {templates.length === 0 ? (
              <div className="chip chip-warn w-full justify-start whitespace-normal px-4 py-2.5 text-[12.5px]">
                Add a contract template first. Deals send contracts from a template.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {field("Client name", <input value={form.clientName} onChange={set("clientName")} className="input" required disabled={pending} />)}
                {field("Company", <input value={form.company} onChange={set("company")} className="input" disabled={pending} />)}
                {field("Email", <input type="email" value={form.email} onChange={set("email")} className="input" placeholder="Where the contract goes" disabled={pending} />, true)}
                {field("What they're buying", <input value={form.service} onChange={set("service")} className="input" placeholder="e.g. Annual platform license" required disabled={pending} />, true)}
                {field("Fee", <input value={form.fee} onChange={set("fee")} className="input" placeholder="e.g. $24,000 / year" required disabled={pending} />)}
                {field(
                  "Contract template",
                  <select value={form.templateId} onChange={set("templateId")} className="input" required disabled={pending}>
                    <option value="" disabled>
                      Pick a template
                    </option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>,
                )}
              </div>
            )}
            {error && <div className="chip chip-warn w-full justify-start whitespace-normal px-4 py-2.5 text-[12.5px]">{error}</div>}
            <div className="flex flex-wrap gap-2">
              {templates.length > 0 ? (
                <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating the deal…" : "Create deal"}</button>
              ) : (
                <Link href="/templates" className="btn btn-primary">Go to templates</Link>
              )}
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
