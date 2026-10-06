import { describe, expect, it } from "vitest";
import { consentFor, isCallTestWorkspace, recordingDecision } from "./call-consent";

describe("Recording rules by the lead's number", () => {
  it("places US numbers by area code", () => {
    expect(consentFor("+15125550100")).toEqual({ state: "TX", rule: "one_party" });
    expect(consentFor("+12125550100")).toEqual({ state: "NY", rule: "one_party" });
    expect(consentFor("+14155550100")).toEqual({ state: "CA", rule: "all_party" });
    expect(consentFor("+13055550100")).toEqual({ state: "FL", rule: "all_party" });
    expect(consentFor("+12025550100")).toEqual({ state: "DC", rule: "one_party" });
  });

  it("treats territories as unknown, and Canada, toll-free and missing numbers apart", () => {
    expect(consentFor("+17875550100")).toEqual({ state: "PR", rule: "unknown" });
    expect(consentFor("+14165550100")).toEqual({ state: null, rule: "non_us" }); // Toronto
    expect(consentFor("+447700900123")).toEqual({ state: null, rule: "non_us" });
    expect(consentFor("+18885550100")).toEqual({ state: null, rule: "toll_free" });
    expect(consentFor(null)).toEqual({ state: null, rule: "no_number" });
  });

  it("records strict states only with the notice, and only when the workspace allows it", () => {
    expect(recordingDecision("one_party", "skip")).toEqual({ record: true, announce: false });
    expect(recordingDecision("all_party", "skip")).toEqual({ record: false, announce: false });
    expect(recordingDecision("all_party", "announce")).toEqual({ record: true, announce: true });
    expect(recordingDecision("unknown", "announce")).toEqual({ record: true, announce: true });
    for (const rule of ["non_us", "toll_free", "no_number"] as const) expect(recordingDecision(rule, "announce")).toEqual({ record: false, announce: false });
  });

  it("records outside the US only in a test workspace, and only after the notice", () => {
    expect(recordingDecision("non_us", "announce")).toEqual({ record: false, announce: false });
    expect(recordingDecision("non_us", "skip", { testMode: true })).toEqual({ record: true, announce: true });
    expect(recordingDecision("toll_free", "skip", { testMode: true })).toEqual({ record: false, announce: false });
    process.env.CALL_TEST_WORKSPACES = "ws_a, ws_b";
    expect(isCallTestWorkspace("ws_b")).toBe(true);
    expect(isCallTestWorkspace("ws_c")).toBe(false);
    delete process.env.CALL_TEST_WORKSPACES;
  });
});
