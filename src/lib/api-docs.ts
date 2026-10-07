// One description of the public API, used by the /developers page and by
// /api/v1/openapi.json, so the two can't drift apart. Keep it in step with
// the routes under src/app/api/v1 and the payloads in src/lib/webhooks.ts.

export type DocField = { name: string; type: string; required?: boolean; description: string };
export type DocEndpoint = {
  id: string;
  group: "Deals" | "Clients" | "Contracts" | "Templates" | "Leads";
  method: "GET" | "POST" | "PATCH";
  path: string;
  summary: string;
  description: string;
  write?: boolean;
  query?: DocField[];
  body?: DocField[];
  exampleBody?: Record<string, unknown>;
  responses: { status: number; description: string; schema?: SchemaName; list?: boolean; example?: unknown }[];
};
export type SchemaName = "Deal" | "DealDetail" | "Client" | "Contract" | "Template" | "Lead";

const iso = "2026-10-04T14:32:10.000Z";

export const EXAMPLES: Record<SchemaName, Record<string, unknown>> = {
  Deal: {
    id: "cmdeal8f2k0001",
    status: "ready",
    source: "api",
    service: "Brand identity refresh",
    fee: "$8,500",
    value: 8500,
    currency: "USD",
    client: { id: "cmcli4h1x0002", name: "Avery Chen", company: "Northwind Studio", email: "avery.chen@example.com" },
    owner: { name: "Dana Lopez", email: "dana@yourcompany.com" },
    url: "https://app.sealme.net/deals/cmdeal8f2k0001",
    createdAt: iso,
    updatedAt: iso,
  },
  DealDetail: {
    id: "cmdeal8f2k0001",
    status: "ready",
    source: "api",
    service: "Brand identity refresh",
    fee: "$8,500",
    value: 8500,
    currency: "USD",
    client: { id: "cmcli4h1x0002", name: "Avery Chen", company: "Northwind Studio", email: "avery.chen@example.com" },
    owner: { name: "Dana Lopez", email: "dana@yourcompany.com" },
    url: "https://app.sealme.net/deals/cmdeal8f2k0001",
    createdAt: iso,
    updatedAt: iso,
    summary: "Avery wants a full brand refresh before the spring launch. Agreed on $8,500, half upfront.",
    terms: [
      { key: "clientName", label: "Client", value: "Avery Chen", status: "extracted" },
      { key: "service", label: "Service", value: "Brand identity refresh", status: "extracted" },
      { key: "fee", label: "Fee", value: "$8,500", status: "extracted" },
      { key: "startDate", label: "Start date", value: null, status: "missing" },
    ],
    contract: { id: "cmcon2b9q0003", status: "sent", sentAt: iso, signedAt: null, url: "https://app.sealme.net/deals/cmdeal8f2k0001/contract" },
  },
  Client: { id: "cmcli4h1x0002", name: "Avery Chen", company: "Northwind Studio", email: "avery.chen@example.com", billingAddress: null, url: "https://app.sealme.net/clients/cmcli4h1x0002", createdAt: iso },
  Contract: {
    id: "cmcon2b9q0003",
    status: "signed",
    dealId: "cmdeal8f2k0001",
    client: { id: "cmcli4h1x0002", name: "Avery Chen", company: "Northwind Studio" },
    sentAt: iso,
    viewedAt: iso,
    signedAt: iso,
    expiresAt: null,
    signerName: "Avery Chen",
    renewalDate: "2027-10-04T00:00:00.000Z",
    autoRenews: false,
    url: "https://app.sealme.net/deals/cmdeal8f2k0001/contract",
  },
  Template: { id: "cmtpl7c3d0004", name: "Service Agreement", description: "General-purpose agreement for project work.", locked: false },
  Lead: {
    id: "cmlead5e6f0005",
    externalId: "hs-48213",
    name: "Sam Rivera",
    company: "Acme Freight",
    title: "Head of Revenue Operations",
    email: "sam.rivera@example.com",
    phone: "+12025550161",
    domain: "acmefreight.com",
    stage: "contacted",
    interest: "warm",
    isDecisionMaker: true,
    painPoints: "Contracts take a week to go out after a call.",
    objections: null,
    nextStep: "Demo with the RevOps team",
    nextStepAt: "2026-10-20",
    summary: null,
    notes: null,
    source: "api",
    owner: { name: "Dana Lopez", email: "dana@yourcompany.com" },
    lastContactedAt: iso,
    convertedDealId: null,
    convertedAt: null,
    url: "https://app.sealme.net/leads/cmlead5e6f0005",
    createdAt: iso,
    updatedAt: iso,
  },
};

export const SCHEMA_FIELDS: Record<SchemaName, DocField[]> = {
  Deal: [
    { name: "id", type: "string", description: "Deal id." },
    { name: "status", type: "string", description: "processing, missing_info, extraction_failed, ready, pending_approval, changes_requested, sent or signed." },
    { name: "source", type: "string", description: "Where the deal came from: zoom, meet, local, upload, manual, renewal or api." },
    { name: "service", type: "string", description: "What's being sold, as agreed on the call." },
    { name: "fee", type: "string", description: "The agreed fee, as written (e.g. \"$4,000 a month\")." },
    { name: "value", type: "number | null", description: "The fee as a number (\"$4,000 a month\" is 4000; \"$8.5k\" is 8500). Null when the fee has no number in it." },
    { name: "currency", type: "string | null", description: "ISO code read from the fee (\"$\" is USD, \"€\" EUR...). Null when the fee doesn't say." },
    { name: "client", type: "object", description: "{ id, name, company, email }" },
    { name: "owner", type: "object | null", description: "{ name, email } of the teammate who owns the deal." },
    { name: "url", type: "string", description: "Where the deal opens in SealMe." },
    { name: "createdAt", type: "string", description: "ISO 8601." },
    { name: "updatedAt", type: "string", description: "ISO 8601." },
  ],
  DealDetail: [
    { name: "…", type: "", description: "Everything in Deal, plus:" },
    { name: "summary", type: "string | null", description: "A short summary of the call." },
    { name: "terms", type: "array", description: "The agreed terms: { key, label, value, status }, status being extracted, confirmed, user_edited or missing." },
    { name: "contract", type: "object | null", description: "{ id, status, sentAt, signedAt, url } once a contract exists." },
  ],
  Client: [
    { name: "id", type: "string", description: "Client id." },
    { name: "name", type: "string", description: "Contact's name." },
    { name: "company", type: "string", description: "Company name." },
    { name: "email", type: "string | null", description: "Where contracts are sent." },
    { name: "billingAddress", type: "string | null", description: "Billing address." },
    { name: "url", type: "string", description: "Where the client opens in SealMe." },
    { name: "createdAt", type: "string", description: "ISO 8601." },
  ],
  Contract: [
    { name: "id", type: "string", description: "Contract id." },
    { name: "status", type: "string", description: "draft, pending_approval, changes_requested, sent, partially_signed, signed or expired." },
    { name: "dealId", type: "string", description: "The deal it belongs to." },
    { name: "client", type: "object", description: "{ id, name, company }" },
    { name: "sentAt / viewedAt / signedAt / expiresAt", type: "string | null", description: "ISO 8601 timestamps." },
    { name: "signerName", type: "string | null", description: "Who signed for the client." },
    { name: "renewalDate", type: "string | null", description: "When the agreement renews, read from the signed contract." },
    { name: "autoRenews", type: "boolean | null", description: "Whether it renews on its own." },
    { name: "url", type: "string", description: "Where the contract opens in SealMe." },
  ],
  Template: [
    { name: "id", type: "string", description: "Template id, for POST /deals." },
    { name: "name", type: "string", description: "Template name." },
    { name: "description", type: "string", description: "What it's for." },
    { name: "locked", type: "boolean", description: "Locked after legal review; can't be edited without approval." },
  ],
  Lead: [
    { name: "id", type: "string", description: "Lead id." },
    { name: "externalId", type: "string | null", description: "Your own id for the lead, if you sent one." },
    { name: "name, company, title, email, phone, domain", type: "string | null", description: "Who the person is. Phone is E.164 when it parses." },
    { name: "stage", type: "string", description: "new, contacted, interested, meeting, converted or lost." },
    { name: "interest", type: "string | null", description: "cold, warm or hot." },
    { name: "isDecisionMaker", type: "boolean | null", description: "From the calls so far." },
    { name: "painPoints, objections, summary, notes", type: "string | null", description: "Filled in from processed calls, or by hand." },
    { name: "nextStep / nextStepAt", type: "string | null", description: "What's next, and on which day (YYYY-MM-DD)." },
    { name: "source", type: "string", description: "manual, paste, csv, xlsx, hubspot, salesforce, call or api." },
    { name: "owner", type: "object | null", description: "{ name, email } of the rep it's assigned to." },
    { name: "convertedDealId / convertedAt", type: "string | null", description: "Set once the lead became a deal." },
    { name: "url", type: "string", description: "Where the lead opens in SealMe." },
    { name: "lastContactedAt, createdAt, updatedAt", type: "string", description: "ISO 8601." },
  ],
};

const cursorParams: DocField[] = [{ name: "cursor", type: "string", description: "nextCursor from the previous page. Pages hold 50 items." }];
const updatedSince: DocField = { name: "updatedSince", type: "string", description: "ISO 8601. Only what changed at or after this time." };
const leadBody: DocField[] = [
  { name: "name", type: "string", required: true, description: "The person's name. Required on create." },
  { name: "externalId", type: "string", description: "Your own id for the lead (your CRM's or dialer's), up to 200 characters. Unique in the workspace: a second lead with the same one answers 409. Comes back on the lead and in every webhook about it." },
  { name: "company", type: "string", description: "Company." },
  { name: "title", type: "string", description: "Job title." },
  { name: "email", type: "string", description: "Email. A lead with the same email or phone already here answers 409." },
  { name: "phone", type: "string", description: "Any format; stored as E.164 when it parses." },
  { name: "domain", type: "string", description: "Company website or domain." },
  { name: "stage", type: "string", description: "new, contacted, interested, meeting, converted or lost." },
  { name: "interest", type: "string", description: "cold, warm or hot." },
  { name: "nextStep", type: "string", description: "What's next." },
  { name: "nextStepAt", type: "string", description: "YYYY-MM-DD." },
  { name: "notes", type: "string", description: "Free text, up to 4,000 characters." },
  { name: "ownerEmail", type: "string", description: "Email of an active teammate to assign it to; null unassigns." },
];

export const ENDPOINTS: DocEndpoint[] = [
  {
    id: "list-deals",
    group: "Deals",
    method: "GET",
    path: "/deals",
    summary: "List deals",
    description: "Every deal in the workspace, oldest first. Deals in the trash aren't included.",
    query: [{ name: "status", type: "string", description: "Only deals with this status." }, updatedSince, ...cursorParams],
    responses: [{ status: 200, description: "A page of deals.", schema: "Deal", list: true }],
  },
  {
    id: "get-deal",
    group: "Deals",
    method: "GET",
    path: "/deals/{id}",
    summary: "Get a deal",
    description: "One deal with its summary, the agreed terms and its contract.",
    responses: [{ status: 200, description: "The deal.", schema: "DealDetail" }, { status: 404, description: "No such deal in this workspace." }],
  },
  {
    id: "create-deal",
    group: "Deals",
    method: "POST",
    path: "/deals",
    summary: "Start a deal",
    description:
      "Two ways. Send a call transcript and a template, and SealMe reads the agreed terms the same way it does for a call: the answer is 202 with the deal \"processing\", and it becomes \"ready\" or \"missing_info\" (or \"extraction_failed\") a few seconds later, when deal.created fires. Or send terms you already know (service and fee) for a deal that's \"ready\" right away (201).",
    write: true,
    body: [
      { name: "transcript", type: "string", description: "The call, as text, up to 400,000 characters. Needs templateId." },
      { name: "templateId", type: "string", description: "Which template's terms to look for (GET /templates). Required with a transcript." },
      { name: "client", type: "object", description: "{ name, company, email }. With a transcript, anything left out is filled in from the call." },
      { name: "clientId", type: "string", description: "An existing client instead of client." },
      { name: "service", type: "string", description: "Without a transcript: what's being sold." },
      { name: "fee", type: "string", description: "Without a transcript: the fee, as written." },
      { name: "ownerEmail", type: "string", description: "Email of the teammate who owns the deal." },
    ],
    exampleBody: { transcript: "Rep: … The total is $18,000, half upfront …", templateId: "cmtpl7c3d0004", client: { company: "Northwind Studio" }, ownerEmail: "dana@yourcompany.com" },
    responses: [
      { status: 202, description: "Transcript accepted; the deal is processing.", schema: "Deal", example: { ...EXAMPLES.Deal, status: "processing", service: "", fee: "", client: { id: "cmcli4h1x0002", name: "New client", company: "Northwind Studio", email: null } } },
      { status: 201, description: "Deal created from known terms.", schema: "Deal" },
      { status: 400, description: "Something in the body is missing or wrong; the error says what." },
      { status: 413, description: "The transcript is too long." },
    ],
  },
  {
    id: "list-clients",
    group: "Clients",
    method: "GET",
    path: "/clients",
    summary: "List clients",
    description: "Every client in the workspace, oldest first.",
    query: cursorParams,
    responses: [{ status: 200, description: "A page of clients.", schema: "Client", list: true }],
  },
  {
    id: "get-client",
    group: "Clients",
    method: "GET",
    path: "/clients/{id}",
    summary: "Get a client",
    description: "One client.",
    responses: [{ status: 200, description: "The client.", schema: "Client" }, { status: 404, description: "No such client in this workspace." }],
  },
  {
    id: "create-client",
    group: "Clients",
    method: "POST",
    path: "/clients",
    summary: "Add a client",
    description: "Adds a client, for example from your CRM, so a deal can be started for them.",
    write: true,
    body: [
      { name: "name", type: "string", required: true, description: "Contact's name." },
      { name: "company", type: "string", description: "Company; the name is used when left out." },
      { name: "email", type: "string", description: "Where contracts go." },
      { name: "billingAddress", type: "string", description: "Billing address." },
    ],
    exampleBody: { name: "Avery Chen", company: "Northwind Studio", email: "avery.chen@example.com" },
    responses: [{ status: 201, description: "The new client.", schema: "Client" }, { status: 400, description: "name is missing." }],
  },
  {
    id: "get-contract",
    group: "Contracts",
    method: "GET",
    path: "/contracts/{id}",
    summary: "Get a contract",
    description: "One contract: where it is in signing, and the renewal terms read from it once signed.",
    responses: [{ status: 200, description: "The contract.", schema: "Contract" }, { status: 404, description: "No such contract in this workspace." }],
  },
  {
    id: "list-templates",
    group: "Templates",
    method: "GET",
    path: "/templates",
    summary: "List templates",
    description: "The contract templates a deal can use.",
    responses: [{ status: 200, description: "All templates (not paged).", schema: "Template", list: true }],
  },
  {
    id: "list-leads",
    group: "Leads",
    method: "GET",
    path: "/leads",
    summary: "List leads",
    description: "Prospects your reps call before they become deals. Only in workspaces with Prospecting turned on; otherwise 403.",
    query: [
      { name: "stage", type: "string", description: "new, contacted, interested, meeting, converted or lost." },
      { name: "ownerEmail", type: "string", description: "Only one rep's leads." },
      { name: "externalId", type: "string", description: "The lead with this externalId (your own id)." },
      updatedSince,
      ...cursorParams,
    ],
    responses: [{ status: 200, description: "A page of leads.", schema: "Lead", list: true }],
  },
  {
    id: "get-lead",
    group: "Leads",
    method: "GET",
    path: "/leads/{id}",
    summary: "Get a lead",
    description: "One lead.",
    responses: [{ status: 200, description: "The lead.", schema: "Lead" }, { status: 404, description: "No such lead in this workspace." }],
  },
  {
    id: "create-lead",
    group: "Leads",
    method: "POST",
    path: "/leads",
    summary: "Add a lead",
    description: "Adds a lead. If one with the same externalId, email or phone is already here the answer is 409 with its id, so a sync can update it instead. Fires lead.created.",
    write: true,
    body: leadBody,
    exampleBody: { name: "Sam Rivera", company: "Acme Freight", email: "sam.rivera@example.com", phone: "+1 202 555 0161", ownerEmail: "dana@yourcompany.com" },
    responses: [
      { status: 201, description: "The new lead.", schema: "Lead" },
      { status: 409, description: "Already here.", example: { error: "A lead with this externalId already exists", existingId: "cmlead5e6f0005" } },
      { status: 400, description: "Something in the body is wrong; the error says what." },
    ],
  },
  {
    id: "update-lead",
    group: "Leads",
    method: "PATCH",
    path: "/leads/{id}",
    summary: "Update a lead",
    description: "Changes only the fields you send; null clears one. Setting stage to converted records when. Fires lead.updated when something changed.",
    write: true,
    body: leadBody.map((f) => ({ ...f, required: false })),
    exampleBody: { stage: "meeting", nextStep: "Demo with the RevOps team", nextStepAt: "2026-10-20" },
    responses: [
      { status: 200, description: "The updated lead.", schema: "Lead" },
      { status: 404, description: "No such lead in this workspace." },
      { status: 409, description: "Another lead already has that externalId.", example: { error: "Another lead already has this externalId", existingId: "cmlead9a1b0007" } },
    ],
  },
];

export type DocEvent = { name: string; when: string; data: Record<string, unknown> };

const deal = { dealUrl: "https://app.sealme.net/deals/cmdeal8f2k0001", feeDisplay: "$8,500", dealValue: 8500, currency: "USD" };
const contractLinks = { ...deal, contractUrl: "https://app.sealme.net/deals/cmdeal8f2k0001/contract" };
const leadUrl = "https://app.sealme.net/leads/cmlead5e6f0005";
const leadNow = { leadId: "cmlead5e6f0005", externalId: "hs-48213", name: "Sam Rivera", company: "Acme Freight", title: "Head of Revenue Operations", email: "sam.rivera@example.com", phone: "+12025550161" };
const rep = { name: "Dana Lopez", email: "dana@yourcompany.com" };

// Every event about a lead or a deal also carries leadUrl / dealUrl (and
// contractUrl with a contract), and one about a deal its value as a number.
export const EVENTS: DocEvent[] = [
  {
    name: "deal.created",
    when: "A deal is started: from a call, a pasted transcript, a converted lead, a renewal or the API. Deals started from a transcript fire once their terms are in.",
    data: { dealId: "cmdeal8f2k0001", clientId: "cmcli4h1x0002", clientName: "Avery Chen", company: "Northwind Studio", service: "Brand identity refresh", feeDisplay: "$8,500", status: "ready", source: "api", owner: rep, createdAt: iso, dealUrl: deal.dealUrl, dealValue: 8500, currency: "USD" },
  },
  { name: "contract.sent", when: "A contract goes out for signature.", data: { dealId: "cmdeal8f2k0001", contractId: "cmcon2b9q0003", clientName: "Avery Chen", signLink: "https://app.sealme.net/sign/cmcon2b9q0003", ...contractLinks } },
  { name: "contract.viewed", when: "The client opens the contract for the first time.", data: { dealId: "cmdeal8f2k0001", contractId: "cmcon2b9q0003", clientName: "Avery Chen", viewedAt: iso, ...contractLinks } },
  { name: "contract.signed", when: "Everyone who has to sign has signed.", data: { dealId: "cmdeal8f2k0001", contractId: "cmcon2b9q0003", clientName: "Avery Chen", signerName: "Avery Chen", signedAt: iso, ...contractLinks } },
  { name: "contract.declined", when: "A signer declines and asks for changes.", data: { dealId: "cmdeal8f2k0001", contractId: "cmcon2b9q0003", signerName: "Jordan Patel", signerEmail: "jordan.patel@example.com", reason: "Payment terms need to be net 30.", declinedAt: iso, ...contractLinks } },
  { name: "contract.expired", when: "A sent contract passes its expiry date unsigned.", data: { dealId: "cmdeal8f2k0001", contractId: "cmcon2b9q0003", sentAt: iso, expiredAt: iso, ...contractLinks } },
  { name: "lead.created", when: "A lead is added: by hand, from a file, from HubSpot or Salesforce, or through the API.", data: { ...leadNow, stage: "new", source: "hubspot", owner: rep, createdAt: iso, leadUrl } },
  {
    name: "lead.updated",
    when: "Something about a lead changes: its stage, its owner, contact details or what was learned on a call. changed lists the fields; previousStage is set when the stage moved. Fires alongside lead.converted, meeting.booked and call.completed when those change the lead.",
    data: { ...leadNow, stage: "meeting", source: "api", owner: rep, createdAt: iso, changed: ["stage", "nextStep", "nextStepAt"], previousStage: "contacted", updatedAt: iso, leadUrl },
  },
  { name: "lead.converted", when: "A lead is turned into a deal.", data: { leadId: "cmlead5e6f0005", dealId: "cmdeal8f2k0001", clientId: "cmcli4h1x0002", name: "Sam Rivera", company: "Acme Freight", convertedAt: iso, leadUrl, ...deal } },
  {
    name: "call.completed",
    when: "SealMe is done with a call: its notes are written (status processed, with the outcome), or it was set aside (status skipped: nobody picked up, too short, nothing recorded...). A call processed again later fires again with the same callId.",
    data: {
      callId: "cmcall3d4e0006",
      leadId: "cmlead5e6f0005",
      externalId: "hs-48213",
      leadName: "Sam Rivera",
      company: "Acme Freight",
      dealId: null,
      status: "processed",
      kind: "cold",
      outcome: "meeting_booked",
      connected: true,
      skipReason: null,
      summary: "Sam runs RevOps for 40 reps. Contracts take a week after a call. Agreed to a demo Tuesday at 2pm.",
      source: "phone",
      toNumber: "+12025550161",
      recorded: true,
      durationSec: 312,
      rep,
      startedAt: iso,
      endedAt: iso,
      completedAt: iso,
      leadUrl,
    },
  },
  {
    name: "meeting.booked",
    when: "A cold call ends with a meeting, or someone puts a sales call with a lead on a rep's day by hand (source manual). date and time are in timeZone; either can be null when the call didn't pin it down.",
    data: { leadId: leadNow.leadId, externalId: leadNow.externalId, leadName: leadNow.name, company: leadNow.company, title: leadNow.title, email: leadNow.email, phone: leadNow.phone, date: "2026-10-20", time: "14:00", timeZone: "America/New_York", rep, source: "call", callId: "cmcall3d4e0006", taskId: "cmtask7g8h0008", bookedAt: iso, leadUrl },
  },
  {
    name: "task.completed",
    when: "A task is marked done or skipped: by a person (completedBy), or because a processed call covered it (callId).",
    data: {
      taskId: "cmtask7g8h0008",
      type: "cold_call",
      status: "done",
      leadId: "cmlead5e6f0005",
      externalId: "hs-48213",
      leadName: "Sam Rivera",
      dealId: null,
      assignee: rep,
      dueDate: "2026-10-07",
      dueTime: null,
      timeZone: "America/New_York",
      priority: "normal",
      note: null,
      callId: "cmcall3d4e0006",
      completedBy: null,
      completedAt: iso,
      leadUrl,
    },
  },
];

export const BASE_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sealme.net"}/api/v1`;

// "string | null" → ["string", "null"]; "…" rows and blanks are skipped.
function jsonType(t: string): string | string[] | undefined {
  const parts = t.split("|").map((x) => x.trim()).filter((x) => ["string", "number", "boolean", "object", "array", "null"].includes(x));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : parts;
}

// A table row can describe several fields at once ("sentAt / viewedAt");
// in the schema each gets its own property.
function schemaProperties(fields: DocField[]) {
  const props: Record<string, Record<string, unknown>> = {};
  for (const f of fields) {
    const type = jsonType(f.type);
    for (const name of f.name.split(/\s*[,/]\s*/)) {
      if (!/^\w+$/.test(name)) continue;
      props[name] = { ...(type ? { type } : {}), description: f.description };
    }
  }
  return props;
}

function modelSchema(name: SchemaName) {
  const own = schemaProperties(SCHEMA_FIELDS[name]);
  const properties = name === "DealDetail" ? { ...schemaProperties(SCHEMA_FIELDS.Deal), ...own } : own;
  return { type: "object", properties, required: Object.keys(EXAMPLES[name]).filter((k) => k in properties), example: EXAMPLES[name] };
}

// OpenAPI 3.1 for the same API, for code generators and API clients.
export function openApiSpec() {
  const schema = (name: SchemaName) => ({ $ref: `#/components/schemas/${name}` });
  const bodySchema = (fields: DocField[]) => ({ type: "object", properties: schemaProperties(fields), required: fields.filter((f) => f.required).map((f) => f.name) });
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const params = [
      ...(e.path.includes("{id}") ? [{ name: "id", in: "path", required: true, schema: { type: "string" } }] : []),
      ...(e.query ?? []).map((q) => ({ name: q.name, in: "query", required: false, description: q.description, schema: { type: "string" } })),
    ];
    const paged = e.query?.some((q) => q.name === "cursor");
    const responses: Record<string, unknown> = {};
    for (const r of e.responses) {
      const body = r.schema
        ? r.list
          ? { type: "object", properties: { data: { type: "array", items: schema(r.schema) }, ...(paged ? { nextCursor: { type: ["string", "null"] } } : {}) }, required: ["data", ...(paged ? ["nextCursor"] : [])] }
          : schema(r.schema)
        : { $ref: "#/components/schemas/Error" };
      const example = r.example ?? (r.schema ? (r.list ? { data: [EXAMPLES[r.schema]], ...(paged ? { nextCursor: null } : {}) } : EXAMPLES[r.schema]) : undefined);
      responses[String(r.status)] = { description: r.description, content: { "application/json": { schema: body, ...(example ? { example } : {}) } } };
    }
    const error = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
    responses["401"] = error("Missing or wrong API key.");
    responses["429"] = error("Over the rate limit; see Retry-After.");
    if (e.write || e.group === "Leads") responses["403"] = error(e.group === "Leads" ? "The key is read-only, or Prospecting is off for this workspace." : "The key is read-only.");
    paths[e.path] = {
      ...(paths[e.path] ?? {}),
      [e.method.toLowerCase()]: {
        operationId: e.id,
        tags: [e.group],
        summary: e.summary,
        description: e.description,
        parameters: params,
        ...(e.body ? { requestBody: { required: true, content: { "application/json": { schema: bodySchema(e.body), ...(e.exampleBody ? { example: e.exampleBody } : {}) } } } } : {}),
        responses,
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "SealMe API", version: "1.0.0", description: "Read deals, clients, contracts and leads, start deals from call transcripts, and add leads. Webhooks are described at /developers.", contact: { email: "ivan@sealme.net" } },
    servers: [{ url: BASE_URL }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Deals", description: "Deals started from calls, transcripts, leads, renewals or the API." },
      { name: "Clients", description: "The people and companies deals are with." },
      { name: "Contracts", description: "A deal's contract and where it is in signing." },
      { name: "Templates", description: "Contract templates a deal can use." },
      { name: "Leads", description: "Prospects before they become deals (Prospecting)." },
    ],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "An API key from Settings → API & webhooks (sk_live_… or, for a sandbox, sk_test_…)." } },
      schemas: {
        ...Object.fromEntries((Object.keys(SCHEMA_FIELDS) as SchemaName[]).map((n) => [n, modelSchema(n)])),
        Error: { type: "object", properties: { error: { type: "string", description: "What went wrong, written to be shown to a person." }, existingId: { type: "string", description: "On a 409: the record that already exists." } }, required: ["error"] },
      },
    },
  };
}
