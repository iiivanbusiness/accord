import { createPublicKey, verify } from "crypto";

// Telnyx signs every webhook with the account's Ed25519 key over
// "<timestamp>|<raw body>". The public key from Mission Control (Keys &
// Credentials) is the raw 32-byte key in base64; Node needs it wrapped
// as SPKI DER.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
// Older than this is treated as a replay.
const MAX_AGE_SECONDS = 300;

export function verifyTelnyxSignature(options: { body: string; signature: string | null; timestamp: string | null; publicKey: string; now?: number }): boolean {
  const { body, signature, timestamp, publicKey } = options;
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_AGE_SECONDS) return false;
  try {
    const raw = Buffer.from(publicKey, "base64");
    if (raw.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw]), format: "der", type: "spki" });
    return verify(null, Buffer.from(`${timestamp}|${body}`), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export function isTelnyxConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY && process.env.TELNYX_PUBLIC_KEY);
}

// What a Call Control webhook carries, as far as SealMe reads it.
export type TelnyxEvent = {
  data?: {
    id?: string;
    event_type?: string;
    occurred_at?: string;
    payload?: {
      call_control_id?: string;
      call_leg_id?: string;
      call_session_id?: string;
      connection_id?: string;
      client_state?: string | null;
      direction?: string;
      from?: string;
      to?: string;
      state?: string;
    };
  };
};
