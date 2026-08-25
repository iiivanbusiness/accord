"use client";

import { useState } from "react";

export default function DownloadContractButton({ contractId, className }: { contractId: string; className?: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/pdf`);
      if (!res.ok) throw new Error("Failed to download contract");
      const disposition = res.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "contract.pdf";

      // Trigger the save via a blob URL instead of navigating to the PDF
      // route directly — some webviews (notably the desktop app) open PDFs
      // in their own built-in viewer on a plain link click, which replaces
      // the page with no way back to the app since that shell has no
      // browser chrome. A blob download never navigates away at all.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button type="button" onClick={handleDownload} disabled={downloading} className={className}>
      {downloading ? "Downloading…" : "Download PDF"}
    </button>
  );
}
