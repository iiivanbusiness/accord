"use client";

import ErrorScreen from "@/components/ErrorScreen";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="sm-theme flex min-h-screen w-full items-center justify-center" style={{ background: "var(--canvas)" }}>
      <ErrorScreen error={error} retry={retry} homeHref="/" />
    </div>
  );
}
