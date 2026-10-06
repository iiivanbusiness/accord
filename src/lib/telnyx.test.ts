import { generateKeyPairSync, sign } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyTelnyxSignature } from "./telnyx";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
// Mission Control hands out the raw 32-byte key in base64: the last 32
// bytes of the SPKI DER.
const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");

const NOW = 1_791_270_000_000;
const ts = String(NOW / 1000);
const body = JSON.stringify({ data: { event_type: "call.initiated", payload: { call_control_id: "v3:abc" } } });
const signed = (b: string, t = ts) => sign(null, Buffer.from(`${t}|${b}`), privateKey).toString("base64");

describe("Telnyx webhook signature", () => {
  it("accepts an event Telnyx signed", () => {
    expect(verifyTelnyxSignature({ body, signature: signed(body), timestamp: ts, publicKey: rawPublicKey, now: NOW })).toBe(true);
  });

  it("rejects a changed body", () => {
    expect(verifyTelnyxSignature({ body: body.replace("abc", "xyz"), signature: signed(body), timestamp: ts, publicKey: rawPublicKey, now: NOW })).toBe(false);
  });

  it("rejects an old event, even when signed", () => {
    const old = String(NOW / 1000 - 301);
    expect(verifyTelnyxSignature({ body, signature: signed(body, old), timestamp: old, publicKey: rawPublicKey, now: NOW })).toBe(false);
  });

  it("rejects another account's key and missing headers", () => {
    const other = generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
    expect(verifyTelnyxSignature({ body, signature: signed(body), timestamp: ts, publicKey: other, now: NOW })).toBe(false);
    expect(verifyTelnyxSignature({ body, signature: null, timestamp: ts, publicKey: rawPublicKey, now: NOW })).toBe(false);
    expect(verifyTelnyxSignature({ body, signature: signed(body), timestamp: null, publicKey: rawPublicKey, now: NOW })).toBe(false);
    expect(verifyTelnyxSignature({ body, signature: signed(body), timestamp: ts, publicKey: "not-a-key", now: NOW })).toBe(false);
  });
});
