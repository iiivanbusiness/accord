// Starter contract templates for a newly created workspace, so a new
// signup has something usable immediately instead of an empty Templates page.
export function buildDefaultTemplates(agencyName: string) {
  const genericClauses = JSON.stringify([
    { title: "Parties", body: `This Agreement is entered into between ${agencyName} ("Agency") and {clientName} ("Client").` },
    { title: "Scope of Services", body: "Agency will provide {service} for Client as described in this Agreement and any attached statement of work." },
    { title: "Fees & Payment", body: "Client will pay Agency {fee}. Invoices are due within fifteen (15) days of receipt unless otherwise agreed in writing." },
    { title: "Term", body: "This Agreement begins on {startDate} and continues until completed or terminated under the next section." },
    { title: "Termination", body: "Either party may terminate this agreement for convenience with 30 days' written notice, or immediately for uncured material breach." },
    { title: "Confidentiality", body: "Both parties agree to keep the terms of this agreement and any shared business information confidential." },
    { title: "Limitation of Liability", body: "Neither party's liability under this Agreement will exceed the total fees paid in the three months preceding a claim." },
    { title: "Governing Law", body: `This agreement is governed by the laws of the jurisdiction in which ${agencyName} is registered.` },
  ]);

  return [
    { name: "Consulting Agreement", description: "Advisory or strategy engagements, hourly or retainer.", requiredFieldCount: 6, clauses: genericClauses },
    { name: "Freelance Agreement", description: "Simple one-off or short-term freelance work.", requiredFieldCount: 5, clauses: genericClauses },
    { name: "Service Agreement", description: "General-purpose agreement for ongoing client work.", requiredFieldCount: 6, clauses: genericClauses },
  ];
}
