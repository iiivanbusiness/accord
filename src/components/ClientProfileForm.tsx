"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
};

export default function ClientProfileForm({
  client,
  updateAction,
}: {
  client: Client;
  updateAction: (clientId: string, formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateAction(client.id, formData);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save those changes");
      }
    });
  }

  return (
    <form action={handleSubmit} className="card flex flex-col gap-4 p-5">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Name</span>
          <input name="name" defaultValue={client.name} required className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Company</span>
          <input name="company" defaultValue={client.company} required className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Email</span>
          <input name="email" type="email" defaultValue={client.email ?? ""} placeholder="hello@client.com" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Phone</span>
          <input name="phone" type="tel" defaultValue={client.phone ?? ""} placeholder="(555) 123-4567" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium">Billing address</span>
        <input name="billingAddress" defaultValue={client.billingAddress ?? ""} className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm self-start">
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && !isPending && <span className="text-[12px]" style={{ color: "var(--success)" }}>Saved</span>}
      </div>
    </form>
  );
}
