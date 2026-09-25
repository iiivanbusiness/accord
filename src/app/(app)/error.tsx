"use client";

import ErrorScreen from "@/components/ErrorScreen";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} homeHref="/dashboard" />;
}
