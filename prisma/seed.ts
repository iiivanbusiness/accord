import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const url = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const marketingClauses = JSON.stringify([
  { title: "Services", body: "Horizon Media will provide {service} services for {clientName}, including content planning, creation, and publishing across the client's primary channels." },
  { title: "Deliverables", body: "{deliverables}, published according to an agreed content calendar." },
  { title: "Fees", body: "{clientName} will pay Horizon Media {fee} for the services described above." },
  { title: "Term", body: "This agreement covers a period of {duration}, beginning {startDate}." },
  { title: "Payment Terms", body: "Fees are billed {paymentTerms}, due upon receipt of invoice." },
  { title: "Termination", body: "Either party may terminate this agreement with 30 days' written notice." },
  { title: "Confidentiality", body: "Both parties agree to keep the terms of this agreement and any shared business information confidential." },
  { title: "Governing Law", body: "This agreement is governed by the laws of the jurisdiction in which Horizon Media is registered." },
]);

const creativeClauses = JSON.stringify([
  { title: "Services", body: "Horizon Media will design a complete {service} for {clientName}." },
  { title: "Deliverables", body: "{deliverables}." },
  { title: "Fees", body: "{clientName} will pay Horizon Media {fee}, split {paymentTerms}." },
  { title: "Term", body: "Work begins on {startDate}." },
  { title: "Termination", body: "{cancellation}" },
  { title: "Billing", body: "Invoices will be sent to {billingAddress}." },
  { title: "Confidentiality", body: "Both parties agree to keep the terms of this agreement and any shared business information confidential." },
  { title: "Governing Law", body: "This agreement is governed by the laws of the jurisdiction in which Horizon Media is registered." },
]);

const genericClauses = JSON.stringify([
  { title: "Services", body: "Horizon Media will provide {service} for {clientName}." },
  { title: "Fees", body: "{clientName} will pay Horizon Media {fee}." },
  { title: "Term", body: "This agreement begins on {startDate}." },
  { title: "Termination", body: "Either party may terminate this agreement with 30 days' written notice." },
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
