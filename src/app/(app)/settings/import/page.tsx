import Link from "next/link";
import { requirePermission } from "@/lib/permissions";
import BulkImportForm from "@/components/BulkImportForm";
import { importClientsAndDeals } from "../import-actions";

export default async function BulkImportPage() {
  await requirePermission("canManageWorkspace");

  return (
    <>
    <div className="mb-6">
      <Link href="/settings" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>← Settings</Link>
      <h1 className="mt-2 text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Bulk import</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Bring clients and deals over from a previous system in one pass instead of re-entering them by hand.
      </div>
    </div>

    <div className="card mb-4 max-w-[680px]">
      <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Import from CSV</h2>
        <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          A client that already exists (matched by email, or by name + company) is reused rather than duplicated — safe to include the same client across several rows, or re-run a file with new rows added.
        </div>
      </div>
      <BulkImportForm importAction={importClientsAndDeals} />
    </div>
    </>
  );
}
