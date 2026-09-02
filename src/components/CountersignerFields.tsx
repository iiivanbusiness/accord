"use client";

import { useState } from "react";

type Row = { id: number; name: string; email: string; role: string };

let nextId = 1;

export default function CountersignerFields({ clientName }: { clientName: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  function addRow() {
    setRows((r) => [...r, { id: nextId++, name: "", email: "", role: "" }]);
  }

  function removeRow(id: number) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Additional signers <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>(optional — sign after {clientName}, in order)</span></span>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <input name="signerName" placeholder="Name" className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }} defaultValue={row.name} />
          <input name="signerEmail" type="email" placeholder="Email" className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }} defaultValue={row.email} />
          <input name="signerRole" placeholder="Role (e.g. Legal)" className="input" style={{ fontSize: "13px", padding: "8px 11px", width: 140 }} defaultValue={row.role} />
          <button type="button" onClick={() => removeRow(row.id)} className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="btn btn-secondary btn-sm w-fit">+ Add signer</button>
    </div>
  );
}
