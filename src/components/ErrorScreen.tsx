"use client";

import { useEffect } from "react";
import Link from "next/link";

// Errors that came from the server carry a digest and were already reported
// by instrumentation.ts; only crashes that happened in the browser get sent.
export function reportBrowserError(error: Error & { digest?: string }) {
  if (error.digest) return;
  try {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, page: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export default function ErrorScreen({ error, retry, homeHref }: { error: Error & { digest?: string }; retry: () => void; homeHref: string }) {
  useEffect(() => {
    reportBrowserError(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4 py-16">
      <div className="card flex w-full max-w-[420px] flex-col gap-4 p-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[20px] font-medium" style={{ letterSpacing: "-0.4px", color: "var(--ink)" }}>
            Something went wrong
          </h1>
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            This page hit an error. We&apos;ve been notified and will look into it. Your data is safe. Try again, and if it keeps happening, contact{" "}
            <Link href="/support" style={{ color: "var(--accent-blue)" }}>
              support
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => retry()} className="btn btn-primary flex-1 justify-center">
            Try again
          </button>
          <Link href={homeHref} className="btn btn-secondary flex-1 justify-center">
            Go back
          </Link>
        </div>
        {error.digest && (
          <p className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
