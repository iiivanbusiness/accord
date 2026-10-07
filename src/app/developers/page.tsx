import Link from "next/link";
import { BASE_URL, ENDPOINTS, EVENTS, EXAMPLES, SCHEMA_FIELDS, type DocEndpoint, type DocField, type SchemaName } from "@/lib/api-docs";
import { API_RATE_LIMIT } from "@/lib/api-auth";
import { MAX_WEBHOOK_ATTEMPTS } from "@/lib/webhooks";

export const metadata = {
  title: "API docs - SealMe",
  description: "The SealMe REST API and webhooks: deals, contracts, clients and leads.",
};

const GROUPS = ["Deals", "Clients", "Contracts", "Templates", "Leads", "Calls", "Tasks"] as const;
const SAMPLE_ID: Partial<Record<DocEndpoint["group"], string>> = { Leads: "cmlead5e6f0005", Clients: "cmcli4h1x0002", Contracts: "cmcon2b9q0003", Calls: "cmcall3d4e0006", Tasks: "cmtask7g8h0008" };

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function curlFor(e: DocEndpoint) {
  const path = e.path.replace("{id}", SAMPLE_ID[e.group] ?? "cmdeal8f2k0001");
  const query = e.method === "GET" && e.id === "list-deals" ? "?status=ready" : e.id === "list-leads" ? "?stage=new" : "";
  const lines = [`curl ${e.method === "GET" ? "" : `-X ${e.method} `}${BASE_URL}${path}${query}`, `  -H "Authorization: Bearer sk_live_…"`];
  if (e.exampleBody) lines.push(`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(e.exampleBody)}'`);
  return lines.join(" \\\n");
}

function exampleResponse(e: DocEndpoint) {
  const r = e.responses[0];
  if (r.example) return { status: r.status, body: r.example };
  if (!r.schema) return null;
  const item = EXAMPLES[r.schema];
  const paged = e.query?.some((q) => q.name === "cursor");
  return { status: r.status, body: r.list ? { data: [item], ...(paged ? { nextCursor: null } : {}) } : item };
}

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="min-w-0">
      {label && <div className="mb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>{label}</div>}
      <pre className="font-mono-tab overflow-x-auto rounded-[10px] px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--ink)" }}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Fields({ fields, title }: { fields: DocField[]; title: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>{title}</div>
      <div className="overflow-x-auto rounded-[10px]" style={{ border: "1px solid var(--hairline)" }}>
        <table className="w-full text-left text-[13px]">
          <tbody>
            {fields.map((f) => (
              <tr key={f.name} className="border-b last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                <td className="whitespace-nowrap px-3 py-2 align-top">
                  <code className="font-mono-tab text-[12.5px]" style={{ color: "var(--ink)" }}>{f.name}</code>
                  {f.required && <span className="ml-1.5 text-[11px]" style={{ color: "var(--warn)" }}>required</span>}
                </td>
                <td className="px-3 py-2 align-top" style={{ color: "var(--ink-muted)" }}>
                  {f.type && <span className="font-mono-tab mr-1.5 text-[12px]">{f.type}</span>}
                  {f.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const tone = method === "GET" ? "chip-neutral" : method === "POST" ? "chip-success" : "chip-warn";
  return <span className={`chip ${tone} font-mono-tab`} style={{ fontSize: 11 }}>{method}</span>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 text-[22px] font-medium" style={{ letterSpacing: "-0.4px", color: "var(--ink)" }}>{title}</h2>
      <div className="flex flex-col gap-4 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{children}</div>
    </section>
  );
}

const NODE_VERIFY = `import crypto from "node:crypto";

// rawBody: the request body exactly as received (a Buffer or string),
// before any JSON parsing.
export function verifySealMeSignature(rawBody, header, secret) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

const PYTHON_VERIFY = `import hashlib
import hmac

def verify_sealme_signature(raw_body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")`;

export default function DevelopersPage() {
  const nav = [
    { id: "start", label: "Getting started" },
    { id: "auth", label: "Keys and access" },
    { id: "conventions", label: "Requests and errors" },
    ...GROUPS.map((g) => ({ id: g.toLowerCase(), label: g })),
    { id: "objects", label: "Objects" },
    { id: "webhooks", label: "Webhooks" },
    { id: "sandbox", label: "Sandbox" },
  ];

  return (
    <div style={{ background: "var(--canvas)", color: "var(--ink)" }} className="min-h-screen">
      <header className="sticky top-0 z-10" style={{ background: "color-mix(in srgb, var(--canvas) 85%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--hairline)" }}>
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo-dark.png" alt="SealMe" className="h-[18px] w-auto" />
            <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>API</span>
          </Link>
          <div className="flex items-center gap-4 text-[13px]">
            <a href="/api/v1/openapi.json" className="font-medium" style={{ color: "var(--accent-blue)" }}>OpenAPI</a>
            <Link href="/settings/developers" style={{ color: "var(--ink-muted)" }}>Your keys →</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1180px] gap-10 px-4 py-12 sm:px-6">
        <nav className="sticky top-24 hidden h-fit w-[190px] flex-none flex-col gap-1.5 text-[13px] lg:flex" aria-label="On this page">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="rounded-[8px] px-2.5 py-1" style={{ color: "var(--ink-muted)" }}>{n.label}</a>
          ))}
        </nav>

        <main className="flex min-w-0 max-w-[780px] flex-1 flex-col gap-14">
          <div>
            <h1 className="text-[34px] font-medium" style={{ letterSpacing: "-0.8px", color: "var(--primary)" }}>SealMe API</h1>
            <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Read deals, contracts, clients and leads; start a deal from a call transcript; add and update leads; and get a signed webhook the moment something happens.
            </p>
          </div>

          <Section id="start" title="Getting started">
            <p>All requests go to:</p>
            <Code>{BASE_URL}</Code>
            <p>
              Make a key in <Link href="/settings/developers" style={{ color: "var(--accent-blue)" }}>Settings → API &amp; webhooks</Link> (workspace admins only) and send it as a bearer token:
            </p>
            <Code>{`curl ${BASE_URL}/deals \\\n  -H "Authorization: Bearer sk_live_…"`}</Code>
            <p>
              Prefer a client generator or Postman? The same API is described in <a href="/api/v1/openapi.json" style={{ color: "var(--accent-blue)" }}>OpenAPI 3.1</a>.
            </p>
          </Section>

          <Section id="auth" title="Keys and access">
            <ul className="ml-5 flex list-disc flex-col gap-1.5">
              <li>A key belongs to one workspace and sees all of it. Keep it on your server, never in a browser or app.</li>
              <li>
                <strong style={{ color: "var(--ink)" }}>Read only</strong> keys can list and fetch; <strong style={{ color: "var(--ink)" }}>Read and write</strong> keys can also create and change. A read-only key gets 403 on anything that writes.
              </li>
              <li>Keys start with <code className="font-mono-tab">sk_live_</code>. Sandbox keys start with <code className="font-mono-tab">sk_test_</code> and only see the sandbox.</li>
              <li>SealMe stores only a hash of each key, so a lost key can&apos;t be shown again; revoke it and make a new one.</li>
            </ul>
          </Section>

          <Section id="conventions" title="Requests and errors">
            <ul className="ml-5 flex list-disc flex-col gap-1.5">
              <li>Bodies are JSON with <code className="font-mono-tab">Content-Type: application/json</code>. Dates are ISO 8601 in UTC; days are <code className="font-mono-tab">YYYY-MM-DD</code>.</li>
              <li>Lists return <code className="font-mono-tab">{`{ data, nextCursor }`}</code> with up to 50 items. Pass <code className="font-mono-tab">nextCursor</code> back as <code className="font-mono-tab">cursor</code> until it&apos;s null. <code className="font-mono-tab">updatedSince</code> keeps a sync incremental.</li>
              <li>{API_RATE_LIMIT} requests a minute per key. Over that the answer is 429 with <code className="font-mono-tab">Retry-After</code> in seconds.</li>
              <li>Errors are <code className="font-mono-tab">{`{ "error": "…" }`}</code> with a message written to be shown to a person: 400 bad input, 401 bad key, 403 not allowed, 404 not found, 409 already exists, 413 too large, 429 too many requests.</li>
            </ul>
          </Section>

          {GROUPS.map((group) => (
            <Section key={group} id={group.toLowerCase()} title={group}>
              {group === "Leads" && <p>Leads are part of Prospecting, which is turned on per workspace. Without it these answer 403. An agency calling for several clients can put each lead in a campaign (the client), and filter and get events by it.</p>}
              {group === "Calls" && (
                <p>
                  Calls made in SealMe, and calls from your own dialer that you log here. Log one with just its outcome and it&apos;s saved right away; send its transcript or a link to its recording and SealMe writes the notes and updates the lead the same way it does for its own calls. Calls you log aren&apos;t written to your CRM by SealMe, since your dialer usually does that already. Part of Prospecting.
                </p>
              )}
              {group === "Tasks" && <p>The reps&apos; to-dos: cold calls, sales calls (booked meetings), follow-ups. Book a meeting from outside SealMe, move it, or cancel it. Part of Prospecting.</p>}
              {ENDPOINTS.filter((e) => e.group === group).map((e) => {
                const example = exampleResponse(e);
                return (
                  <article key={e.id} id={e.id} className="card flex scroll-mt-24 flex-col gap-3.5 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <MethodBadge method={e.method} />
                      <code className="font-mono-tab break-all text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{e.path}</code>
                      {e.write && <span className="chip chip-neutral" style={{ fontSize: 10.5 }}>read and write key</span>}
                    </div>
                    <div>
                      <div className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>{e.summary}</div>
                      <p className="mt-1 text-[14px]">{e.description}</p>
                    </div>
                    {e.query && <Fields title="Query" fields={e.query} />}
                    {e.body && <Fields title="Body" fields={e.body} />}
                    <Code label="Request">{curlFor(e)}</Code>
                    {example && <Code label={`Response ${example.status}`}>{json(example.body)}</Code>}
                    {e.responses.length > 1 && (
                      <div className="text-[13px]">
                        {e.responses.slice(1).map((r) => (
                          <div key={r.status}>
                            <code className="font-mono-tab">{r.status}</code> {r.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </Section>
          ))}

          <Section id="objects" title="Objects">
            {(Object.keys(SCHEMA_FIELDS) as SchemaName[]).map((name) => (
              <div key={name} id={`object-${name.toLowerCase()}`} className="scroll-mt-24">
                <div className="mb-2 text-[15px] font-medium" style={{ color: "var(--ink)" }}>{name}</div>
                <Fields title="Fields" fields={SCHEMA_FIELDS[name]} />
              </div>
            ))}
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p>
              Add an endpoint in <Link href="/settings/developers" style={{ color: "var(--accent-blue)" }}>Settings → API &amp; webhooks</Link>, pick events, and SealMe POSTs JSON to it when they happen:
            </p>
            <Code>{json({ id: "evt_3f9c1a2b7d6e4f8a9b0c1d2e", event: "contract.signed", created: "2026-10-04T14:32:10.000Z", timestamp: "2026-10-04T14:32:10.000Z", data: { "…": "see each event below" } })}</Code>
            <Fields
              title="Headers"
              fields={[
                { name: "X-SealMe-Signature", type: "", description: "sha256= followed by the hex HMAC-SHA256 of the raw body, keyed with the endpoint's signing secret (whsec_…)." },
                { name: "X-SealMe-Event", type: "", description: "The event name." },
                { name: "X-SealMe-Event-Id", type: "", description: "Same as id in the body. Identical on every retry and resend." },
                { name: "X-SealMe-Delivery", type: "", description: "This delivery." },
                { name: "X-SealMe-Attempt", type: "", description: `1 for the first try, up to ${MAX_WEBHOOK_ATTEMPTS}.` },
              ]}
            />
            <p>
              <strong style={{ color: "var(--ink)" }}>Check the signature</strong> on the raw body before trusting anything in it, and reject requests whose <code className="font-mono-tab">created</code> is old if replays worry you:
            </p>
            <Code label="Node.js">{NODE_VERIFY}</Code>
            <Code label="Python">{PYTHON_VERIFY}</Code>
            <p>
              <strong style={{ color: "var(--ink)" }}>Answer 2xx quickly</strong> (within 10 seconds) and do the work afterwards. Anything else (an error, a timeout, a redirect) is retried after 1 minute, 5 minutes, 30 minutes, 2, 6 and 12 hours: {MAX_WEBHOOK_ATTEMPTS} attempts over about a day. Failed deliveries can be sent again from Settings. Because of retries the same event can arrive twice, so skip an <code className="font-mono-tab">id</code> you&apos;ve already handled. Order isn&apos;t guaranteed.
            </p>
            <p>Endpoints must be public https URLs; private and local addresses are refused.</p>
            <p>
              Every event about a lead or a deal links to it in SealMe (<code className="font-mono-tab">leadUrl</code>, <code className="font-mono-tab">dealUrl</code>, and <code className="font-mono-tab">contractUrl</code> with a contract), and one about a deal carries its value as a number (<code className="font-mono-tab">dealValue</code>, <code className="font-mono-tab">currency</code>) next to the fee as written. A lead you added with an <code className="font-mono-tab">externalId</code> carries it in every event about it.
            </p>
            <div className="flex flex-col gap-4">
              {EVENTS.map((ev) => (
                <article key={ev.name} id={`event-${ev.name.replace(".", "-")}`} className="card flex scroll-mt-24 flex-col gap-2.5 p-4 sm:p-5">
                  <code className="font-mono-tab text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{ev.name}</code>
                  <p className="text-[14px]">{ev.when}</p>
                  <Code label="data">{json(ev.data)}</Code>
                </article>
              ))}
            </div>
          </Section>

          <Section id="sandbox" title="Sandbox">
            <p>
              Build against a sandbox instead of your real workspace: Settings → API &amp; webhooks → Sandbox makes a separate workspace with your templates and a few sample deals and leads. It has its own <code className="font-mono-tab">sk_test_</code> keys and webhooks, uses the same URL, and nothing in it reaches a real client or your CRM. Reset it to the sample data or delete it whenever you like.
            </p>
            <p>Deals started from a transcript in the sandbox still have their terms read by AI, so use short transcripts.</p>
          </Section>

          <footer className="border-t pt-6 text-[13px]" style={{ borderColor: "var(--hairline)", color: "var(--ink-muted)" }}>
            Questions or something missing? <a href="mailto:ivan@sealme.net" style={{ color: "var(--accent-blue)" }}>ivan@sealme.net</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
