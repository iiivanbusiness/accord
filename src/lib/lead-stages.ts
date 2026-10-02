export const LEAD_STAGES = ["new", "contacted", "interested", "meeting", "converted", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  meeting: "Meeting booked",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_STAGE_CHIP: Record<string, string> = {
  new: "chip-neutral",
  contacted: "chip-active",
  interested: "chip-warn",
  meeting: "chip-warn",
  converted: "chip-success",
  lost: "chip-danger",
};

export const LEAD_INTERESTS = ["cold", "warm", "hot"] as const;

export const LEAD_INTEREST_LABEL: Record<string, string> = { cold: "Cold", warm: "Warm", hot: "Hot" };

export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}
