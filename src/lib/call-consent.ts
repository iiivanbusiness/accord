import { US_AREA_CODE_STATE } from "@/lib/us-area-codes";

// States where everyone on a call has to agree to it being recorded.
// Anywhere else in the US, the rep's own consent is enough.
export const ALL_PARTY_STATES = new Set(["CA", "FL", "IL", "PA", "WA", "MD", "MA", "MT", "NV", "NH", "DE", "CT"]);

const STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const TOLL_FREE = new Set(["800", "833", "844", "855", "866", "877", "888"]);

export type ConsentRule = "one_party" | "all_party" | "unknown" | "non_us" | "toll_free" | "no_number";

// The recording rule for a call to this number, read off its area code.
// A US territory or an area code we can't place is "unknown", which gets
// the same treatment as an all-party state.
export function consentFor(phone: string | null | undefined): { state: string | null; rule: ConsentRule } {
  if (!phone) return { state: null, rule: "no_number" };
  const us = phone.match(/^\+1(\d{3})\d{7}$/);
  if (!us) return { state: null, rule: phone.startsWith("+") ? "non_us" : "no_number" };
  const areaCode = us[1];
  if (TOLL_FREE.has(areaCode)) return { state: null, rule: "toll_free" };
  const state = US_AREA_CODE_STATE.get(areaCode) ?? null;
  // +1 also covers Canada and the Caribbean.
  if (!state) return { state: null, rule: "non_us" };
  if (!STATES.has(state)) return { state, rule: "unknown" };
  return { state, rule: ALL_PARTY_STATES.has(state) ? "all_party" : "one_party" };
}

// Whether SealMe records, and whether it plays the recording notice first.
// No number, toll-free and non-US numbers are never recorded; strict and
// unplaceable states follow the workspace's choice.
export function recordingDecision(rule: ConsentRule, allPartyStatePolicy: string): { record: boolean; announce: boolean } {
  if (rule === "one_party") return { record: true, announce: false };
  if ((rule === "all_party" || rule === "unknown") && allPartyStatePolicy === "announce") return { record: true, announce: true };
  return { record: false, announce: false };
}
