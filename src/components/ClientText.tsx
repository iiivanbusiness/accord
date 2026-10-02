"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Text that depends on the viewer's locale, timezone, or clock (times,
// "5m ago") can't be rendered on the server: the server formats "15:40"
// in UTC, the browser "3:40 PM" in local time, and React throws a
// hydration mismatch. This renders nothing on the server and fills the
// text in once the page is running in the browser.
export default function ClientText({ text }: { text: () => string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  return <>{isClient ? text() : ""}</>;
}
