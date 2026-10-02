"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parseCsv } from "@/lib/csv";
import { detectDelimiter, guessMapping, IMPORT_CHUNK_SIZE, IMPORT_FIELDS, MAX_IMPORT_ROWS, rowName, type ImportFieldKey, type ImportRow } from "@/lib/lead-import";

type Source = "paste" | "csv" | "xlsx";
type Parsed = { headers: string[]; rows: string[][]; source: Source; fileName: string | null };
type Workbook = { fileName: string; sheets: { name: string; rows: string[][] }[]; current: number };
type Result = { created: number; updated: number; skipped: number };

export default function LeadImporter({
  owners,
  canAssign,
  startAction,
  chunkAction,
}: {
  owners: { id: string; name: string }[];
  canAssign: boolean;
  startAction: (source: string, fileName: string | null) => Promise<{ importId: string }>;
  chunkAction: (importId: string, rows: ImportRow[], ownerChoice: string | null) => Promise<Result>;
}) {
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [reading, setReading] = useState(false);
  const [pasted, setPasted] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<(ImportFieldKey | "")[]>([]);
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function load(text: string, source: "paste" | "csv", fileName: string | null) {
    loadTable(parseCsv(text, detectDelimiter(text)), source, fileName);
  }

  function loadTable(all: string[][], source: Source, fileName: string | null): boolean {
    setError(null);
    if (all.length < 2) {
      setError(source === "paste" ? "We need a header row plus at least one lead. Copy the column names too." : "We need a header row plus at least one lead in that sheet.");
      return false;
    }
    const headers = all[0].map((h, i) => h.trim() || `Column ${i + 1}`);
    const rows = all.slice(1);
    if (rows.length > MAX_IMPORT_ROWS) {
      setError(`That's ${rows.length.toLocaleString("en-US")} rows. Import up to ${MAX_IMPORT_ROWS.toLocaleString("en-US")} at a time.`);
      return false;
    }
    setParsed({ headers, rows, source, fileName });
    setMapping(guessMapping(headers));
    return true;
  }

  function pickSheet(wb: Workbook, index: number) {
    setWorkbook({ ...wb, current: index });
    if (!loadTable(wb.sheets[index].rows, "xlsx", wb.fileName)) setParsed(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("That file is over 10 MB. Split it and import it in parts.");
      return;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xls")) {
      setError("That's the old Excel format (.xls). In Excel, use File, Save As, and pick .xlsx or .csv, then upload that.");
      return;
    }
    if (lower.endsWith(".xlsx")) {
      setReading(true);
      setError(null);
      try {
        // Loaded only when someone picks an Excel file, so it doesn't weigh
        // down every other page.
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const sheets = (await readXlsxFile(file))
          .map((s) => ({ name: s.sheet, rows: s.data.map((row) => row.map(cellText)).filter((row) => row.some((c) => c.trim())) }))
          .filter((s) => s.rows.length > 0);
        if (sheets.length === 0) {
          setError("That workbook looks empty.");
          return;
        }
        // Start on the first sheet that has a header and at least one row.
        const first = Math.max(0, sheets.findIndex((s) => s.rows.length >= 2));
        pickSheet({ fileName: file.name, sheets, current: first }, first);
      } catch {
        setError("We couldn't read that Excel file. If it's password-protected, remove the password, or save it as .csv and upload that.");
      } finally {
        setReading(false);
      }
      return;
    }
    setWorkbook(null);
    load(await file.text(), "csv", file.name);
  }

  const mappedRows = useMemo<ImportRow[]>(() => {
    if (!parsed) return [];
    return parsed.rows.map((cells) => {
      const row: ImportRow = {};
      mapping.forEach((field, i) => {
        if (field && cells[i]?.trim()) row[field] = cells[i].trim();
      });
      return row;
    });
  }, [parsed, mapping]);

  const withName = mappedRows.filter((r) => rowName(r)).length;
  const hasNameColumn = mapping.includes("name") || mapping.includes("firstName") || mapping.includes("lastName");

  async function runImport() {
    if (!parsed) return;
    setError(null);
    setProgress({ done: 0, total: mappedRows.length });
    try {
      const { importId } = await startAction(parsed.source, parsed.fileName);
      const total: Result = { created: 0, updated: 0, skipped: 0 };
      for (let i = 0; i < mappedRows.length; i += IMPORT_CHUNK_SIZE) {
        const r = await chunkAction(importId, mappedRows.slice(i, i + IMPORT_CHUNK_SIZE), owner || null);
        total.created += r.created;
        total.updated += r.updated;
        total.skipped += r.skipped;
        setProgress({ done: Math.min(i + IMPORT_CHUNK_SIZE, mappedRows.length), total: mappedRows.length });
      }
      setResult(total);
    } catch {
      setError("The import stopped partway. Leads that went in are saved; try the rest again.");
    } finally {
      setProgress(null);
    }
  }

  function reset() {
    setParsed(null);
    setWorkbook(null);
    setMapping([]);
    setResult(null);
    setPasted("");
    setError(null);
  }

  if (result) {
    return (
      <div className="card flex max-w-[640px] flex-col gap-4 p-5 sm:p-6">
        <div className="text-[16px] font-medium">Import finished</div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="New leads" value={result.created} />
          <Stat label="Updated" value={result.updated} />
          <Stat label="Skipped" value={result.skipped} />
        </div>
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          Updated means someone with the same email or phone was already here; we only filled in fields that were empty. Skipped rows had no name, repeated a row above them, or had nothing new.
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads" className="btn btn-primary btn-sm">See leads</Link>
          <button type="button" onClick={reset} className="btn btn-secondary btn-sm">Import more</button>
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="card flex max-w-[720px] flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {(["paste", "file"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="btn btn-sm"
              style={mode === m ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
            >
              {m === "paste" ? "Paste from a sheet" : "Upload a file"}
            </button>
          ))}
        </div>
        {mode === "paste" ? (
          <>
            <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
              In Excel or Google Sheets, select the rows including the column names, copy, and paste here.
            </div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={9}
              placeholder={"Name\tCompany\tEmail\tPhone\nLisa Smith\tRxBenefits\tlisa@rxbenefits.com\t(205) 555-0123"}
              className="input font-mono-tab text-[12.5px]"
            />
            <button type="button" disabled={!pasted.trim()} onClick={() => load(pasted, "paste", null)} className="btn btn-primary w-full justify-center sm:w-auto sm:self-start">
              Next
            </button>
          </>
        ) : (
          <>
            <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
              An Excel (.xlsx) or CSV file, like an export from Apollo, Clay, HubSpot, or Salesforce. The first row should be the column names.
            </div>
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={reading}
              onChange={(e) => onFile(e.target.files?.[0])}
              className="input text-[13px]"
            />
            {reading && <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Reading the workbook…</div>}
          </>
        )}
        {error && <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[12.5px]">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <div className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <div className="text-[15px] font-medium">Match your columns</div>
          <div className="mt-1 text-[13px]" style={{ color: "var(--ink-muted)" }}>
            {parsed.fileName ? `${parsed.fileName}, ` : ""}{parsed.rows.length.toLocaleString("en-US")} {parsed.rows.length === 1 ? "row" : "rows"}. We matched what we could; change anything that&apos;s off.
          </div>
        </div>
        {workbook && workbook.sheets.length > 1 && (
          <label className="flex max-w-[320px] flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>Sheet</span>
            <select value={workbook.current} onChange={(e) => pickSheet(workbook, Number(e.target.value))} className="input" disabled={Boolean(progress)}>
              {workbook.sheets.map((s, i) => (
                <option key={i} value={i} disabled={s.rows.length < 2}>
                  {s.name} ({s.rows.length < 2 ? "no leads" : sheetRowCount(s.rows.length)})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--hairline-soft)" }}>
          {parsed.headers.map((header, i) => {
            const sample = parsed.rows.find((r) => r[i]?.trim())?.[i]?.trim() ?? "";
            return (
              <div key={i} className="grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:gap-4" style={{ borderColor: "var(--hairline-soft)" }}>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium" title={header}>{header}</div>
                  <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }} title={sample}>{sample || "Empty"}</div>
                </div>
                <select
                  value={mapping[i] ?? ""}
                  onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? (e.target.value as ImportFieldKey | "") : v)))}
                  className="input"
                  style={{ fontSize: "13px", padding: "7px 11px" }}
                  aria-label={`What "${header}" is`}
                >
                  <option value="">Don&apos;t import</option>
                  {IMPORT_FIELDS.map((f) => (
                    <option key={f.key} value={f.key} disabled={mapping.includes(f.key) && mapping[i] !== f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-5 sm:p-6">
        {canAssign && (
          <label className="flex max-w-[320px] flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>Assign these leads to</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
              <option value="">Nobody yet (Unassigned)</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="text-[13px]">
          {hasNameColumn ? (
            <>
              <span className="font-medium">{withName.toLocaleString("en-US")}</span> of {mappedRows.length.toLocaleString("en-US")} {mappedRows.length === 1 ? "row" : "rows"}{" "}
              {withName === 1 ? "has a name and will be imported." : "have a name and will be imported."}
              {withName < mappedRows.length && <span style={{ color: "var(--ink-muted)" }}> Rows without a name are skipped.</span>}
            </>
          ) : (
            <span style={{ color: "var(--warn)" }}>Pick which column has the name (full name, or first and last name).</span>
          )}
        </div>
        {progress && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%`, background: "var(--primary)" }} />
            </div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {progress.done.toLocaleString("en-US")} of {progress.total.toLocaleString("en-US")}
            </div>
          </div>
        )}
        {error && <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[12.5px]">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!hasNameColumn || withName === 0 || Boolean(progress)} onClick={runImport} className="btn btn-primary">
            {progress ? "Importing…" : `Import ${withName.toLocaleString("en-US")} ${withName === 1 ? "lead" : "leads"}`}
          </button>
          <button type="button" disabled={Boolean(progress)} onClick={reset} className="btn btn-secondary">Start over</button>
        </div>
      </div>
    </div>
  );
}

function sheetRowCount(rowsIncludingHeader: number): string {
  const n = Math.max(0, rowsIncludingHeader - 1);
  return `${n.toLocaleString("en-US")} ${n === 1 ? "row" : "rows"}`;
}

// Excel cells come back typed. Phone numbers stored as numbers become
// digits (never 5.12E+9), dates become YYYY-MM-DD, empty cells "".
function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  if (typeof cell === "number") return Number.isInteger(cell) ? cell.toFixed(0) : String(cell);
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
      <div className="font-mono-tab text-[20px] font-medium">{value.toLocaleString("en-US")}</div>
      <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{label}</div>
    </div>
  );
}
