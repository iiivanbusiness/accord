import Link from "next/link";
import { createTemplateFromDocument } from "../actions";

export default function UploadTemplatePage() {
  return (
    <>
    <Link href="/templates" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
      ← Templates
    </Link>

    <div className="mb-6 max-w-[520px]">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Upload a contract</h1>
      <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        Upload an existing agreement (.pdf, .docx, or .txt) and we&apos;ll split it into clauses you can review and turn into a reusable template.
      </div>
    </div>

    <form action={createTemplateFromDocument} className="card flex max-w-[520px] flex-col gap-4 p-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Template name</span>
        <input name="name" required placeholder="e.g. Standard NDA" className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Document</span>
        <input name="file" type="file" required accept=".pdf,.docx,.txt" className="input" style={{ padding: "8px 11px" }} />
        <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
          We look for numbered sections like &quot;1. Services&quot; to split it into clauses — if we can&apos;t find that structure, the whole document becomes one clause you can split by hand.
        </span>
      </label>

      <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
        Upload &amp; create template
      </button>
    </form>
    </>
  );
}
