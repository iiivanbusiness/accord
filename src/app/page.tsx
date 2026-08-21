import Link from "next/link";
import HowItWorksPanels from "@/components/HowItWorksPanels";
import Reveal from "@/components/Reveal";
import { auth } from "@/lib/auth";

const FEATURES = [
  {
    title: "Never leave the call",
    body: "The companion overlay lives inside the meeting itself — SealMe never joins as a participant.",
  },
  {
    title: "No more chasing signatures",
    body: "Contracts go out while the deal is still warm, not three days later in a forgotten inbox.",
  },
  {
    title: "Every deal, one workspace",
    body: "Calls, clients, templates, and calendar — the whole funnel in a single place, not five tabs.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    tagline: "Try the funnel on your own calls.",
    cta: "Start free",
    highlighted: false,
    features: [
      "1 seat",
      "Up to 10 deals / mo",
      "AI call companion (beta)",
      "2 contract templates",
      "E-signature",
    ],
  },
  {
    name: "Team",
    price: "$49",
    period: "/seat / mo",
    tagline: "For teams closing on every call.",
    cta: "Choose Team",
    highlighted: true,
    features: [
      "Unlimited deals",
      "Live field capture on every call",
      "Unlimited custom templates",
      "Calendar + Zoom / Meet sync",
      "Deal analytics",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "Security and support at scale.",
    cta: "Contact sales",
    highlighted: false,
    features: [
      "SSO & audit logs",
      "Custom contract workflows",
      "Dedicated support",
      "Custom integrations",
    ],
  },
];

export default async function LandingPage() {
  const session = await auth();
  const primaryNavHref = session?.user ? "/deals" : "/login";
  const primaryNavLabel = session?.user ? "Dashboard" : "Sign in";

  return (
    <div style={{ background: "var(--canvas)", color: "var(--ink)" }}>
      {/* Nav */}
      <header className="sticky top-0 z-10" style={{ background: "rgba(9,9,9,0.8)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--hairline)" }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <img src="/logo-dark.png" alt="SealMe" className="h-[20px] w-auto" />
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#how-it-works" className="rounded-full px-3 py-2 text-[13px]" style={{ color: "var(--ink-muted)" }}>How it works</a>
            <a href="#pricing" className="rounded-full px-3 py-2 text-[13px]" style={{ color: "var(--ink-muted)" }}>Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={primaryNavHref} className="rounded-full px-4 py-2 text-[13px] font-medium" style={{ background: "var(--primary)", color: "var(--on-primary)" }}>
              {primaryNavLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-[1200px] overflow-hidden px-6 pt-20 pb-16 text-center">
        <div
          className="hero-glow pointer-events-none absolute left-1/2 top-[40px] h-[420px] w-[720px] -translate-x-1/2"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <div className="chip chip-neutral mx-auto mb-6 w-fit uppercase tracking-wide" style={{ fontSize: "11px", fontWeight: 600 }}>
            Now live on sales calls
          </div>

          <div className="relative mx-auto max-w-[820px]">
            {/* Floating themed objects — flank the headline */}
            <div className="hero-float-1 pointer-events-none absolute right-full top-1/2 mr-6 hidden -translate-y-1/2 xl:block" aria-hidden="true">
              <div className="hero-chip">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M4 10.5l4 4 8-9" /></svg>
                <span className="text-[12.5px] font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>Contract signed</span>
              </div>
            </div>
            <div className="hero-float-2 pointer-events-none absolute left-full top-1/2 ml-6 hidden -translate-y-1/2 xl:block" aria-hidden="true">
              <div className="hero-chip">
                <span className="chip-dot" style={{ background: "var(--accent-blue)" }} />
                <span className="text-[12.5px] font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>€2,500/mo captured</span>
              </div>
            </div>

            <h1
              className="text-[44px] font-medium sm:text-[56px] md:text-[64px]"
              style={{ letterSpacing: "-1.4px", lineHeight: 1.02, color: "var(--primary)" }}
            >
              Close the deal before the prospect leaves the call.
            </h1>
          </div>

          <p className="mx-auto mt-6 max-w-[560px] text-[16px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            SealMe listens on the call, fills in the contract as your prospect talks, and gets it signed before they hang up. No follow-up, no cold leads.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button type="button" className="btn btn-primary">
              Get started
            </button>
            <a href="#how-it-works" className="btn btn-secondary">
              See how it works
            </a>
          </div>

          {/* Platform compatibility */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="text-[11.5px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Works inside
            </span>
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              <svg width="15" height="15" viewBox="0 0 20 20">
                <rect x="2" y="5" width="12" height="10" rx="2.2" fill="#2D8CFF" />
                <path d="M14.5 8.5l4-2.4v7.8l-4-2.4z" fill="#2D8CFF" />
              </svg>
              Zoom
            </span>
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              <svg width="15" height="15" viewBox="0 0 26 26">
                <rect x="0" y="0" width="13" height="13" fill="#00ac47" />
                <rect x="13" y="0" width="13" height="13" fill="#ffba00" />
                <rect x="0" y="13" width="13" height="13" fill="#0066da" />
                <rect x="13" y="13" width="13" height="13" fill="#ea4335" />
                <rect x="7" y="8.5" width="9" height="7.5" rx="1.8" fill="#fff" />
                <path d="M16 10.5l4.5-2.3v8.2l-4.5-2.3z" fill="#fff" />
              </svg>
              Google Meet
            </span>
          </div>


          {/* Product video — placeholder for VSL */}
          <Reveal className="mx-auto mt-16 max-w-[820px]">
            <div className="card p-6">
              <div
                className="relative flex items-center justify-center overflow-hidden rounded-[14px]"
                style={{ aspectRatio: "16 / 9", background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
              >
                <button
                  type="button"
                  aria-label="Play video"
                  className="flex h-[64px] w-[64px] items-center justify-center rounded-full transition-transform hover:scale-105"
                  style={{ background: "var(--primary)", boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 20 20" fill="var(--on-primary)"><path d="M6 4l10 6-10 6V4Z" /></svg>
                </button>
                <span className="absolute bottom-4 left-4 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                  Product walkthrough — video coming soon
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust band: social proof */}
      <section style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
        <Reveal className="mx-auto max-w-[1200px] px-6 py-8 text-center">
          <span className="text-[14px] font-medium" style={{ color: "var(--ink-muted)" }}>
            Trusted by <strong style={{ color: "var(--ink)" }}>200+ users</strong>
          </span>
        </Reveal>
      </section>

      {/* How it works / funnel */}
      <section id="how-it-works" className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="mx-auto mb-14 max-w-[560px] text-center">
          <h2 className="text-[32px] font-medium" style={{ letterSpacing: "-0.7px", color: "var(--primary)" }}>
            From call to signed contract
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: "var(--ink-muted)" }}>
            The same three steps, every time. That&apos;s the whole funnel.
          </p>
        </div>

        <HowItWorksPanels />
      </section>

      {/* Feature highlights */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <div className="lift rounded-[15px] p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline-soft)" }}>
                <h3 className="mb-1.5 text-[15px] font-medium">{f.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="mx-auto mb-14 max-w-[560px] text-center">
          <h2 className="text-[32px] font-medium" style={{ letterSpacing: "-0.7px", color: "var(--primary)" }}>
            Plans
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: "var(--ink-muted)" }}>
            Simple pricing. Start free, upgrade when the calls start converting.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 100}>
              <div
                className="lift flex h-full flex-col rounded-[20px] p-6"
                style={
                  plan.highlighted
                    ? { background: "var(--surface-1)", border: "1px solid var(--accent-blue)", boxShadow: "0 0 0 3px rgba(0,153,255,0.10)" }
                    : { background: "var(--surface-1)", border: "1px solid var(--hairline)" }
                }
              >
                {plan.highlighted && (
                  <div className="chip chip-active mb-4 w-fit uppercase tracking-wide" style={{ fontSize: "10px", fontWeight: 600, color: "var(--accent-blue)" }}>
                    Most popular
                  </div>
                )}
                <h3 className="text-[16px] font-medium">{plan.name}</h3>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{plan.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-[32px] font-medium" style={{ letterSpacing: "-0.7px" }}>{plan.price}</span>
                  <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>{plan.period}</span>
                </div>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                      <svg className="mt-[3px] flex-none" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M4 10.5l4 4 8-9" /></svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={plan.highlighted ? "btn btn-primary mt-7 w-full justify-center" : "btn btn-secondary mt-7 w-full justify-center"}
                >
                  {plan.cta}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <Reveal>
          <div className="card relative flex flex-col items-center gap-5 overflow-hidden p-12 text-center">
            <div
              className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[560px] -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <h2 className="relative z-10 text-[28px] font-medium" style={{ letterSpacing: "-0.6px", color: "var(--primary)" }}>
              Ready to close faster?
            </h2>
            <p className="relative z-10 max-w-[420px] text-[14px]" style={{ color: "var(--ink-muted)" }}>
              Bring SealMe to your next call and watch the contract write itself.
            </p>
            <button type="button" className="btn btn-primary relative z-10">
              Start closing deals
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--hairline)" }}>
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <img src="/logo-dark.png" alt="SealMe" className="h-[16px] w-auto opacity-70" />
          <div className="flex flex-wrap items-center justify-center gap-5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/login">Sign in</Link>
          </div>
          <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
            © {new Date().getFullYear()} SealMe.
          </div>
        </div>
      </footer>
    </div>
  );
}
