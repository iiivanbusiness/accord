import Link from "next/link";

export default function DeveloperSettingsLink() {
  return (
    <div className="card mb-4 max-w-[600px]">
      <Link href="/settings/developers" className="flex items-center justify-between gap-3 px-[22px] py-4">
        <div>
          <h2 className="text-[15px] font-medium">API &amp; webhooks</h2>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Connect your own systems — a REST API and real-time webhooks.
          </div>
        </div>
        <span style={{ color: "var(--ink-muted)" }}>→</span>
      </Link>
    </div>
  );
}
