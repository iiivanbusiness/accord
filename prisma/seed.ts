import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const url = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const marketingClauses = JSON.stringify([
  { title: "Parties", body: "This Marketing Services Agreement (\"Agreement\") is entered into between Horizon Media, a marketing services provider (\"Agency\"), and {clientName} (\"Client\"), collectively the \"Parties.\"" },
  { title: "Scope of Services", body: "Agency will provide {service} on behalf of Client, including strategy, content planning, creative production, scheduling, and publishing across Client's approved channels. Any work outside this scope will be treated as a change order under Section 11." },
  { title: "Deliverables", body: "Agency will deliver {deliverables} per month, published according to a content calendar agreed with Client no later than five (5) business days before the start of each month. Client will have two (2) business days to request revisions to any scheduled item before it is published." },
  { title: "Term", body: "This Agreement begins on {startDate} and continues for {duration}, unless earlier terminated under Section 6. Unless either Party gives 30 days' written notice before the end of the Term, the Agreement renews automatically on a month-to-month basis at the same fee." },
  { title: "Fees", body: "Client will pay Agency {fee} for the Services described in Section 2. Fees do not include third-party costs (advertising spend, licensing, paid talent, or software) incurred on Client's behalf, which will be itemized separately and reimbursed at cost." },
  { title: "Payment Terms", body: "Fees are billed {paymentTerms}. Invoices are due within fifteen (15) days of receipt. Amounts unpaid after thirty (30) days accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower, and Agency may pause Services until the account is current." },
  { title: "Termination", body: "Either Party may terminate this Agreement for convenience with 30 days' written notice, or immediately for a material breach not cured within 10 days of written notice. Client remains responsible for fees earned and costs committed prior to the termination date." },
  { title: "Client Responsibilities", body: "Client will provide brand guidelines, product access, and timely approvals needed for Agency to meet the schedule in Section 3. Delays in Client feedback of more than five (5) business days may extend delivery dates accordingly." },
  { title: "Intellectual Property", body: "Upon full payment, Client owns the final approved deliverables created under this Agreement. Agency retains ownership of its pre-existing tools, templates, and methodologies, and may reference the engagement (excluding confidential details) in its own portfolio and marketing." },
  { title: "Confidentiality", body: "Each Party will keep the other's non-public business, financial, and strategic information confidential, and use it only to perform this Agreement, for three (3) years after the information is disclosed." },
  { title: "Independent Contractor", body: "Agency is an independent contractor, not an employee, partner, or agent of Client. Nothing in this Agreement creates a joint venture or partnership between the Parties." },
  { title: "Limitation of Liability", body: "Except for breaches of Section 10 (Confidentiality), neither Party's total liability under this Agreement will exceed the fees paid by Client in the three (3) months preceding the claim, and neither Party is liable for indirect, incidental, or consequential damages." },
  { title: "Indemnification", body: "Each Party will indemnify the other against third-party claims arising from that Party's breach of this Agreement, negligence, or willful misconduct, except to the extent caused by the other Party." },
  { title: "Force Majeure", body: "Neither Party is liable for delay or failure to perform caused by events beyond its reasonable control, including natural disaster, labor dispute, platform outage, or governmental action, for as long as that event continues." },
  { title: "Governing Law & Disputes", body: "This Agreement is governed by the laws of the jurisdiction in which Agency is registered, without regard to conflict-of-law rules. The Parties will first attempt to resolve any dispute through good-faith negotiation before pursuing other remedies." },
  { title: "Entire Agreement", body: "This Agreement, together with any signed statements of work, is the entire agreement between the Parties on this subject and supersedes all prior discussions or agreements, written or oral. It may only be amended in writing signed by both Parties." },
]);

const creativeClauses = JSON.stringify([
  { title: "Parties", body: "This Creative Services Agreement (\"Agreement\") is entered into between Horizon Media (\"Agency\") and {clientName} (\"Client\")." },
  { title: "Scope of Services", body: "Agency will design and deliver a complete {service} for Client, covering discovery, concept development, up to two (2) rounds of revisions per deliverable, and final files in Client-ready formats." },
  { title: "Deliverables", body: "Agency will deliver {deliverables}. Client approval of each deliverable will be given or withheld, with specific written feedback, within five (5) business days of delivery; deliverables are deemed approved if no feedback is received in that window." },
  { title: "Fees & Payment", body: "Client will pay Agency {fee}, split {paymentTerms}. The final payment is due upon delivery of final files and is not contingent on Client's launch timeline." },
  { title: "Term & Start Date", body: "Work begins on {startDate}. Delivery dates for each milestone will be set out in a project schedule agreed by both Parties within five (5) business days of the start date." },
  { title: "Revisions & Change Orders", body: "Fees in Section 4 include two (2) rounds of revisions per deliverable. Additional rounds, new concepts, or expanded scope will be quoted separately and require written approval before work begins." },
  { title: "Termination", body: "{cancellation}" },
  { title: "Billing Details", body: "Invoices will be sent to {billingAddress}. Amounts unpaid after thirty (30) days may result in paused work until the account is current." },
  { title: "Intellectual Property", body: "Ownership of final deliverables transfers to Client upon receipt of full payment. Until then, all work product remains the property of Agency. Agency retains the right to display the work in its portfolio unless Client requests otherwise in writing." },
  { title: "Confidentiality", body: "Both Parties agree to keep the terms of this Agreement and any shared business information confidential, and not disclose it to third parties without consent." },
  { title: "Limitation of Liability", body: "Neither Party's liability under this Agreement will exceed the total fees paid under Section 4, except for breaches of confidentiality or infringement of the other Party's intellectual property rights." },
  { title: "Governing Law", body: "This Agreement is governed by the laws of the jurisdiction in which Agency is registered." },
]);

const genericClauses = JSON.stringify([
  { title: "Parties", body: "This Agreement is entered into between Horizon Media (\"Agency\") and {clientName} (\"Client\")." },
  { title: "Scope of Services", body: "Agency will provide {service} for Client as described in this Agreement and any attached statement of work." },
  { title: "Fees & Payment", body: "Client will pay Agency {fee}. Invoices are due within fifteen (15) days of receipt unless otherwise agreed in writing." },
  { title: "Term", body: "This Agreement begins on {startDate} and continues until completed or terminated under the next section." },
  { title: "Termination", body: "Either party may terminate this agreement for convenience with 30 days' written notice, or immediately for uncured material breach." },
  { title: "Confidentiality", body: "Both parties agree to keep the terms of this agreement and any shared business information confidential." },
  { title: "Limitation of Liability", body: "Neither party's liability under this Agreement will exceed the total fees paid in the three months preceding a claim." },
  { title: "Governing Law", body: "This agreement is governed by the laws of the jurisdiction in which Horizon Media is registered." },
]);

async function main() {
  await prisma.dealField.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.client.deleteMany();
  await prisma.contractTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();

  const workspace = await prisma.workspace.create({
    data: { name: "Horizon Media", plan: "Growth", callsUsedThisMonth: 6, callsLimit: 15 },
  });

  await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      name: "Horizon Media",
      email: "hello@horizonmedia.com",
      passwordHash: hashPassword("accord2026"),
    },
  });

  const [marketingTpl, creativeTpl, consultingTpl, freelanceTpl, saasTpl] = await Promise.all([
    prisma.contractTemplate.create({
      data: { workspaceId: workspace.id, name: "Marketing Services Agreement", description: "Recurring engagements with monthly deliverables and fees.", requiredFieldCount: 8, clauses: marketingClauses },
    }),
    prisma.contractTemplate.create({
      data: { workspaceId: workspace.id, name: "Creative Services Agreement", description: "Project-based creative work with milestone payments.", requiredFieldCount: 7, clauses: creativeClauses },
    }),
    prisma.contractTemplate.create({
      data: { workspaceId: workspace.id, name: "Consulting Agreement", description: "Advisory or strategy engagements, hourly or retainer.", requiredFieldCount: 6, clauses: genericClauses },
    }),
    prisma.contractTemplate.create({
      data: { workspaceId: workspace.id, name: "Freelance Agreement", description: "Simple one-off or short-term freelance work.", requiredFieldCount: 5, clauses: genericClauses },
    }),
    prisma.contractTemplate.create({
      data: { workspaceId: workspace.id, name: "SaaS Agreement", description: "Subscription software terms with usage limits.", requiredFieldCount: 9, clauses: genericClauses },
    }),
  ]);

  const acmeClient = await prisma.client.create({
    data: { workspaceId: workspace.id, name: "Acme Fitness", company: "Acme Fitness", email: "hello@acmefitness.co" },
  });
  const lumenClient = await prisma.client.create({
    data: { workspaceId: workspace.id, name: "Lumen Coffee Co.", company: "Lumen Coffee Co.", email: "team@lumencoffee.com" },
  });
  const northgateClient = await prisma.client.create({
    data: { workspaceId: workspace.id, name: "Northgate Consulting", company: "Northgate Consulting", email: "ops@northgateconsulting.com" },
  });
  const brightPathClient = await prisma.client.create({
    data: { workspaceId: workspace.id, name: "Bright Path Yoga", company: "Bright Path Yoga", email: "studio@brightpathyoga.com" },
  });

  // Acme Fitness — fully extracted, ready for review
  const acmeDeal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id, clientId: acmeClient.id, templateId: marketingTpl.id,
      service: "Social Media Management", feeDisplay: "€2,500 / month", status: "ready",
      source: "zoom", callLength: "34-minute call",
      fields: { create: [
        { groupLabel: "Client & engagement", label: "Client", fieldKey: "clientName", value: "Acme Fitness", status: "confirmed", orderIndex: 0 },
        { groupLabel: "Client & engagement", label: "Service", fieldKey: "service", value: "Social Media Management", status: "confirmed", orderIndex: 1 },
        { groupLabel: "Commercial terms", label: "Fee", fieldKey: "fee", value: "€2,500 / month", status: "extracted", confidence: 0.94, sourceQuote: "So we'd do twenty-five hundred a month for this — does that work on your end?", orderIndex: 2 },
        { groupLabel: "Commercial terms", label: "Duration", fieldKey: "duration", value: "3 months", status: "extracted", confidence: 0.9, sourceQuote: "Let's start with a three month run and see how it goes.", orderIndex: 3 },
        { groupLabel: "Commercial terms", label: "Payment terms", fieldKey: "paymentTerms", value: "Monthly, in advance", status: "extracted", confidence: 0.88, sourceQuote: "You'd bill us at the start of each month — that's fine.", orderIndex: 4 },
        { groupLabel: "Commercial terms", label: "Start date", fieldKey: "startDate", value: "May 1, 2026", status: "extracted", confidence: 0.92, sourceQuote: "If we can kick off May first that'd be ideal.", orderIndex: 5 },
        { groupLabel: "Deliverables", label: "Content", fieldKey: "deliverables", value: "12 Reels / month", status: "extracted", confidence: 0.9, sourceQuote: "Twelve reels a month, we'll mix in a couple of carousels too.", orderIndex: 6 },
      ]},
    },
  });

  // Lumen Coffee Co. — missing info, mid-pipeline
  await prisma.deal.create({
    data: {
      workspaceId: workspace.id, clientId: lumenClient.id, templateId: creativeTpl.id,
      service: "Brand Identity & Launch Campaign", feeDisplay: "€4,200, one-time", status: "missing_info",
      source: "zoom", callLength: "41-minute call",
      fields: { create: [
        { groupLabel: "Client & engagement", label: "Client", fieldKey: "clientName", value: "Lumen Coffee Co.", status: "confirmed", orderIndex: 0 },
        { groupLabel: "Client & engagement", label: "Service", fieldKey: "service", value: "Brand Identity & Launch Campaign", status: "confirmed", orderIndex: 1 },
        { groupLabel: "Commercial terms", label: "Fee", fieldKey: "fee", value: "€4,200, one-time", status: "extracted", confidence: 0.91, sourceQuote: "Forty-two hundred for the full identity and launch package.", orderIndex: 2 },
        { groupLabel: "Commercial terms", label: "Payment terms", fieldKey: "paymentTerms", value: "50% upfront, 50% on delivery", status: "extracted", confidence: 0.87, sourceQuote: "Half up front, half when you hand it over.", orderIndex: 3 },
        { groupLabel: "Deliverables", label: "Package", fieldKey: "deliverables", value: "Logo suite, brand guidelines, 9-post launch kit", status: "extracted", confidence: 0.85, sourceQuote: "Logo, guidelines, and nine posts to launch the socials.", orderIndex: 4 },
        { groupLabel: "Missing", label: "Start date", fieldKey: "startDate", value: null, status: "missing", orderIndex: 5 },
        { groupLabel: "Missing", label: "Cancellation terms", fieldKey: "cancellation", value: null, status: "missing", orderIndex: 6 },
        { groupLabel: "Missing", label: "Client billing address", fieldKey: "billingAddress", value: null, status: "missing", orderIndex: 7 },
      ]},
    },
  });

  // Northgate Consulting — signed
  const northgateDeal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id, clientId: northgateClient.id, templateId: consultingTpl.id,
      service: "Quarterly Strategy Retainer", feeDisplay: "€3,000 / month", status: "signed", source: "manual",
    },
  });
  await prisma.contract.create({
    data: { dealId: northgateDeal.id, templateId: consultingTpl.id, status: "signed", sentAt: new Date(Date.now() - 4 * 86400000), signedAt: new Date(Date.now() - 3 * 86400000) },
  });

  // Bright Path Yoga — sent, awaiting signature
  const brightPathDeal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id, clientId: brightPathClient.id, templateId: freelanceTpl.id,
      service: "Website & Brand Refresh", feeDisplay: "€6,500, one-time", status: "sent", source: "manual",
    },
  });
  await prisma.contract.create({
    data: { dealId: brightPathDeal.id, templateId: freelanceTpl.id, status: "sent", sentAt: new Date(Date.now() - 1 * 86400000) },
  });

  // A few upcoming calendar events (stubbed — real calendar OAuth comes later)
  const now = new Date();
  await prisma.calendarEvent.createMany({
    data: [
      { workspaceId: workspace.id, title: "Discovery call — Northgate renewal", clientName: "Northgate Consulting", startTime: new Date(now.getTime() + 2 * 3600000), durationMinutes: 30, platform: "zoom" },
      { workspaceId: workspace.id, title: "Kickoff call — Bright Path Yoga", clientName: "Bright Path Yoga", startTime: new Date(now.getTime() + 26 * 3600000), durationMinutes: 45, platform: "zoom" },
      { workspaceId: workspace.id, title: "Intro call — new referral", clientName: null, startTime: new Date(now.getTime() + 50 * 3600000), durationMinutes: 30, platform: "meet" },
    ],
  });

  console.log("Seeded:", { workspace: workspace.name, clients: 4, deals: 4, templates: 5, calendarEvents: 3 });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
