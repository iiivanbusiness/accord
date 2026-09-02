"use client";

import { useRef, useState, useTransition } from "react";

type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const EXAMPLE = `client_name,client_company,client_email,service,fee,status,signed_date
Jane Cooper,Cooper Studio,jane@cooperstudio.com,Brand identity,€4500,signed,2025-11-03
Alex Rivera,Rivera & Co,alex@riveraco.com,Monthly retainer,€2000,sent,`;

export default function BulkImportForm({
  importAction,
}: {
  importAction: (formData: FormData) => Promise<ImportResult>;
}) {
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function handleImport() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("csv", csv);
        const res = await importAction(formData);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        Columns (header row required): <code className="font-mono-tab">client_name, client_company, client_email, service, fee, status, signed_date</code>.
        Only <code className="font-mono-tab">client_name</code> (or <code className="font-mono-tab">client_company</code>), <code className="font-mono-tab">service</code>, and <code className="font-mono-tab">fee</code> are required.
        <code className="font-mono-tab">status</code> is one of signed/sent/ready/missing_info — left blank, a row with a <code className="font-mono-tab">signed_date</code> is treated as signed, otherwise ready.
      </div>

      <pre className="overflow-x-auto rounded-[8px] px-3 py-2.5 font-mono-tab text-[11px]" style={{ background: "var(--surface-2)" }}>{EXAMPLE}</pre>

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="Paste CSV data here, or upload a file below"
        rows={8}
        className="input w-full font-mono-tab"
        style={{ fontSize: "12px", padding: "10px" }}
      />

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="text-[12px]"
        />
        <button type="button" disabled={isPending || !csv.trim()} onClick={handleImport} className="btn btn-primary btn-sm">
          {isPending ? "Importing…" : "Import"}
        </button>
      </div>

      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-[8px] px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
          <div className="text-[13px] font-medium">
            {result.created} created{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {result.errors.map((e, i) => (
                <div key={i} className="text-[11.5px]" style={{ color: "#c0392b" }}>Row {e.row}: {e.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
