import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — SealMe",
};

const LAST_UPDATED = "August 19, 2026";

export default function PrivacyPage() {
  return (
    <div style={{ background: "var(--canvas)", color: "var(--ink)" }} className="min-h-screen">
      <header className="sticky top-0 z-10" style={{ background: "rgba(9,9,9,0.8)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--hairline)" }}>
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <img src="/logo-dark.png" alt="SealMe" className="h-[18px] w-auto" />
          </Link>
          <Link href="/" className="text-[13px]" style={{ color: "var(--ink-muted)" }}>← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-6 py-16">
        <div className="chip chip-warn mb-6 w-fit uppercase tracking-wide" style={{ fontSize: "10.5px", fontWeight: 600 }}>
          Draft — pending legal review
        </div>
        <h1 className="mb-2 text-[36px] font-medium" style={{ letterSpacing: "-0.8px", color: "var(--primary)" }}>Privacy Policy</h1>
        <p className="mb-12 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>Last updated: {LAST_UPDATED}</p>

        <div className="flex flex-col gap-10 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          <Section title="1. Overview">
            <p>
              This Privacy Policy explains how SealMe (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and shares information when you use our website and
              service (the &quot;Service&quot;). It applies to workspace administrators, team members, and — where relevant — the sales prospects whose calls are
              processed through the Service.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul className="ml-5 mt-2 flex list-disc flex-col gap-1.5">
              <li><strong style={{ color: "var(--ink)" }}>Account data</strong> — name, work email, password hash, and workspace details.</li>
              <li><strong style={{ color: "var(--ink)" }}>Call data</strong> — audio captured during calls you connect to SealMe, and the transcripts and deal
                terms extracted from it.</li>
              <li><strong style={{ color: "var(--ink)" }}>Deal and contract data</strong> — client names, pricing, contract templates, clauses, and signature
                records you create in the Service.</li>
              <li><strong style={{ color: "var(--ink)" }}>Calendar data</strong> — if you connect Google Calendar, we access event details needed to schedule
                and match calls to deals.</li>
              <li><strong style={{ color: "var(--ink)" }}>Usage and device data</strong> — log data, browser type, and product usage analytics.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Information">
            <ul className="ml-5 flex list-disc flex-col gap-1.5">
              <li>To operate the Service — capturing deal terms, drafting contracts, and routing them for signature;</li>
              <li>To maintain and secure workspace accounts;</li>
              <li>To provide customer support and respond to requests;</li>
              <li>To improve accuracy of AI-driven field extraction and contract drafting;</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </Section>

          <Section title="4. AI and Third-Party Processing">
            <p>
              Call audio and transcripts may be processed by third-party AI model providers under contract with SealMe in order to extract deal terms and
              generate contract language. These providers are bound by confidentiality and data-processing terms and are not permitted to use your data to
              train their own general-purpose models unless you explicitly opt in.
            </p>
          </Section>

          <Section title="5. Sharing of Information">
            <p>We do not sell your personal information. We share information only with:</p>
            <ul className="ml-5 mt-2 flex list-disc flex-col gap-1.5">
              <li>Sub-processors who host, transcribe, or process data on our behalf (e.g., cloud hosting, AI model providers, e-signature delivery);</li>
              <li>Integrated platforms you connect, such as Zoom, Google Meet, or Google Calendar, to the extent needed for the integration to function;</li>
              <li>Law enforcement or regulators where required by law;</li>
              <li>A successor entity in the event of a merger, acquisition, or asset sale, subject to the same privacy commitments.</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain account, deal, and contract data for as long as your workspace is active, and for a reasonable period afterward to comply with legal,
              accounting, or dispute-resolution requirements. Raw call audio is retained only as long as needed to complete transcription and field extraction,
              after which it is deleted or reduced to a text transcript, unless you configure a longer retention period.
            </p>
          </Section>

          <Section title="7. Data Security">
            <p>
              We use industry-standard technical and organizational measures — including encryption in transit and access controls — to protect information
              against unauthorized access, alteration, or loss. No method of transmission or storage is completely secure, and we cannot guarantee absolute
              security.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>
              Depending on your location, you may have the right to access, correct, export, or delete your personal information, and to object to or restrict
              certain processing. Workspace administrators can manage most of this directly in account settings; you can also contact us using the details
              below. Prospects whose calls are processed through SealMe may direct data requests to the workspace that initiated the call.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              We use essential cookies to keep you signed in and remember basic preferences. We do not use third-party advertising cookies on the Service.
            </p>
          </Section>

          <Section title="10. International Data Transfers">
            <p>
              Information may be processed in countries other than your own. Where required, we rely on appropriate safeguards (such as standard contractual
              clauses) for cross-border transfers of personal data.
            </p>
          </Section>

          <Section title="11. Children&apos;s Privacy">
            <p>The Service is intended for business use and is not directed at individuals under 16. We do not knowingly collect data from children.</p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated to workspace administrators by email or in-app
              notice before they take effect.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              For privacy questions or data requests, contact <span style={{ color: "var(--ink)" }}>privacy@accord.example</span>.
            </p>
          </Section>
        </div>
      </main>

      <footer style={{ borderTop: "1px solid var(--hairline)" }}>
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-6 py-8 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          <span>© {new Date().getFullYear()} SealMe.</span>
          <Link href="/terms">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[19px] font-medium" style={{ letterSpacing: "-0.3px", color: "var(--ink)" }}>{title}</h2>
      {children}
    </section>
  );
}
