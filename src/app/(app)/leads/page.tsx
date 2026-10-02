import { requireProspecting } from "@/lib/prospecting";

export default async function LeadsPage() {
  await requireProspecting();

  return (
    <div className="mb-6">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Leads</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Your lead list is on its way.
      </div>
    </div>
  );
}
