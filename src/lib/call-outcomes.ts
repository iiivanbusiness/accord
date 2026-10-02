export const CALL_OUTCOMES = ["meeting_booked", "interested", "follow_up", "not_interested", "wrong_person", "voicemail", "no_answer"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABEL: Record<string, string> = {
  meeting_booked: "Meeting booked",
  interested: "Interested",
  follow_up: "Follow up later",
  not_interested: "Not interested",
  wrong_person: "Wrong person",
  voicemail: "Voicemail",
  no_answer: "No answer",
};

export const CALL_OUTCOME_CHIP: Record<string, string> = {
  meeting_booked: "chip-success",
  interested: "chip-success",
  follow_up: "chip-neutral",
  not_interested: "chip-warn",
  wrong_person: "chip-neutral",
  voicemail: "chip-neutral",
  no_answer: "chip-neutral",
};

// Outcomes where nobody on the other end actually talked with the rep.
export const UNREACHED_OUTCOMES = new Set<string>(["voicemail", "no_answer"]);
