import Link from "next/link";

export default function UpgradeCard() {
  return (
    <Link
      href="/settings"
      className="card-hover group relative mt-3 flex flex-col gap-3 overflow-hidden rounded-[16px] p-4"
      style={{ background: "var(--surface-inverted)", color: "var(--on-surface-inverted)" }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, var(--gradient-violet), transparent 70%)", opacity: 0.5 }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, var(--gradient-coral), transparent 70%)", opacity: 0.4 }}
        aria-hidden="true"
      />

      <div
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
        style={{ background: "var(--surface-inverted-2)" }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path d="M11.2 1.5L4 11.3h4.6L8.3 18.5l7.5-10.4h-4.9l1.3-6.6z" />
        </svg>
      </div>

      <div className="relative">
        <div className="text-[13px] font-semibold leading-tight">Unlock more calls</div>
        <div className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--on-surface-inverted-muted)" }}>
          Upgrade your plan for higher limits and priority support.
        </div>
      </div>

      <span
        className="relative inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ background: "var(--on-surface-inverted)", color: "var(--surface-inverted)" }}
      >
        Upgrade plan
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10h12M11 5l5 5-5 5" />
        </svg>
      </span>
    </Link>
  );
}
