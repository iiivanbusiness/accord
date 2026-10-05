import { CALL_OUTCOME_LABEL } from "@/lib/call-outcomes";
import { LEAD_INTEREST_LABEL } from "@/lib/lead-stages";

type LeadForHistory = {
  name: string;
  company: string | null;
  interest: string | null;
  isDecisionMaker: boolean | null;
  painPoints: string | null;
  objections: string | null;
  nextStep: string | null;
  nextStepAt: Date | null;
  notes: string | null;
};
type CallForHistory = { startedAt: Date; outcome: string | null; summary: string | null; user: { name: string } | null };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// The note a deal gets when it's made from a lead: what prospecting learned
// about them, and every cold call so far. `how` says what turned the lead
// into a deal ("by Sam", "after Sam's sales call").
export function leadHistoryNote(lead: LeadForHistory, calls: CallForHistory[], how: string): string {
  return [
    `Converted from lead ${lead.name}${lead.company ? ` (${lead.company})` : ""} ${how}.`,
    [
      lead.interest ? `Interest: ${LEAD_INTEREST_LABEL[lead.interest] ?? lead.interest}` : null,
      lead.isDecisionMaker === true ? "Decision maker: yes" : lead.isDecisionMaker === false ? "Decision maker: no" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    lead.painPoints ? `Pain points: ${lead.painPoints}` : null,
    lead.objections ? `Objections: ${lead.objections}` : null,
    lead.nextStep ? `Next step: ${[lead.nextStepAt ? day(lead.nextStepAt) : null, lead.nextStep].filter(Boolean).join(" · ")}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    calls.length
      ? `Calls:\n${calls
          .map((c) => `- ${day(c.startedAt)} · ${CALL_OUTCOME_LABEL[c.outcome ?? ""] ?? "Call"}${c.user ? ` (${c.user.name})` : ""}${c.summary ? `: ${c.summary}` : ""}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
