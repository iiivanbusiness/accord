import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

// Integration tokens and other secrets are stored encrypted (AES-256-GCM),
// so a copy of the database alone doesn't hand anyone a customer's
// HubSpot, Salesforce, DocuSign, Google or Slack access. The key comes from
// SECRETS_ENCRYPTION_KEY; without it values are stored as they are (and
// values stored before encryption existed are read as they are), so
// nothing breaks while it's being rolled out. Losing the key means every
// integration has to be connected again.

const PREFIX = "enc:v1:";
let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  cachedKey = raw ? Buffer.from(hkdfSync("sha256", raw, "sealme", "integration-secrets-v1", 32)) : null;
  return cachedKey;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function canSealSecrets(): boolean {
  return key() !== null;
}

export function sealSecret(plain: string): string {
  if (isSealed(plain)) return plain;
  const k = key();
  if (!k) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64url")).join(".");
}

// The stored value as the app uses it. A value that can't be opened (the
// key is missing or different) comes back null, so that integration shows
// as disconnected instead of every page that loads it failing.
export function openSecret(value: string): string | null {
  if (!isSealed(value)) return value;
  const k = key();
  try {
    if (!k) throw new Error("SECRETS_ENCRYPTION_KEY isn't set");
    const [iv, tag, ciphertext] = value.slice(PREFIX.length).split(".").map((s) => Buffer.from(s, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("Couldn't open a stored secret", err instanceof Error ? err.message : err);
    return null;
  }
}
