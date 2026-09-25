"use client";

import { useEffect } from "react";
import { reportBrowserError } from "@/components/ErrorScreen";

// Replaces the root layout, so globals.css and fonts aren't loaded here.
const STYLES = `
  :root { --bg: #f5f5f7; --card: #ffffff; --ink: #1d1d1f; --muted: #6e6e73; --line: #e5e5ea; --accent: #0a66ff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0b0b0c; --card: #161618; --ink: #f5f5f7; --muted: #a1a1a6; --line: #2c2c2e; --accent: #4d8dff; }
  }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; padding: 16px; box-sizing: border-box; }
  .box { max-width: 420px; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 28px; box-sizing: border-box; }
  h1 { margin: 0 0 6px; font-size: 20px; font-weight: 500; letter-spacing: -0.4px; }
  p { margin: 0 0 18px; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
  a { color: var(--accent); }
  button { width: 100%; border: 0; border-radius: 10px; padding: 11px; font-size: 14px; font-weight: 500; background: var(--ink); color: var(--bg); cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  small { display: block; margin-top: 14px; font-size: 11.5px; color: var(--muted); }
`;

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportBrowserError(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong - SealMe</title>
        <style>{STYLES}</style>
      </head>
      <body>
        <div className="box">
          <h1>Something went wrong</h1>
          <p>
            SealMe hit an error. We&apos;ve been notified and will look into it. Your data is safe. Try again, and if it keeps happening, contact{" "}
            <a href="/support">support</a>.
          </p>
          <button type="button" onClick={() => retry()}>Try again</button>
          {error.digest && <small>Reference: {error.digest}</small>}
        </div>
      </body>
    </html>
  );
}
