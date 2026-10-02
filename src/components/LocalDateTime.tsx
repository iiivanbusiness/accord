"use client";

import ClientText from "@/components/ClientText";

// For server components: a date shown in the viewer's own locale and
// timezone. Takes an ISO string (a function can't cross from a server
// component to a client one, which is why ClientText alone won't do there).
export default function LocalDateTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  return <ClientText text={() => new Date(iso).toLocaleString(undefined, options)} />;
}
