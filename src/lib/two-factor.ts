import { randomBytes, createHash } from "crypto";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export async function generateQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const otpauthUrl = generateURI({ issuer: "SealMe", label: email, secret });
  return QRCode.toDataURL(otpauthUrl);
}

// epochTolerance: 30s either side of the current 30s step, i.e. accepts the
// previous/current/next code — same clock-drift allowance as most apps.
export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code.replace(/\s+/g, ""), epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}

export type BackupCode = { hash: string; usedAt: string | null };

// Backup codes are shown once at generation time — only their SHA-256 hash
// is ever persisted, same reasoning as password reset tokens.
export function generateBackupCodes(count = 8): { raw: string[]; stored: BackupCode[] } {
  const raw: string[] = [];
  const stored: BackupCode[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString("hex"); // 10 hex chars, easy to type
    raw.push(code);
    stored.push({ hash: createHash("sha256").update(code).digest("hex"), usedAt: null });
  }
  return { raw, stored };
}

// Returns the updated codes array (with the matched one marked used) if the
// code was valid and unused, or null if it didn't match anything usable.
export function consumeBackupCode(code: string, codes: BackupCode[]): BackupCode[] | null {
  const hash = createHash("sha256").update(code.replace(/\s+/g, "").toLowerCase()).digest("hex");
  const index = codes.findIndex((c) => c.hash === hash && !c.usedAt);
  if (index === -1) return null;
  const next = [...codes];
  next[index] = { ...next[index], usedAt: new Date().toISOString() };
  return next;
}
