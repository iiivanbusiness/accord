import signpdf from "@signpdf/signpdf";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { P12Signer } from "@signpdf/signer-p12";

export function isPdfSigningConfigured(): boolean {
  return Boolean(process.env.PDF_SIGNING_P12_BASE64 && process.env.PDF_SIGNING_P12_PASSWORD);
}

// Embeds a real PKI digital signature into the PDF itself (PAdES-style,
// detached PKCS#7) — the same mechanism DocuSign uses, so any standard PDF
// reader (Adobe Acrobat included) can independently verify "this file
// hasn't been modified since it was signed" without ever calling back to
// SealMe. Self-signed rather than issued by a public CA (see
// PDF_SIGNING_P12_BASE64's generation script) — Adobe Reader will show
// "signature valid, but the signer's identity hasn't been verified"
// instead of a plain green checkmark. Upgradeable to a CA-issued cert
// later without touching any PDF already issued, since verification only
// cares about the cert embedded in that specific file.
export async function embedTamperEvidentSignature(pdfBuffer: Buffer, opts: { signerName: string; signedAt: Date }): Promise<Buffer> {
  const p12Base64 = process.env.PDF_SIGNING_P12_BASE64;
  const password = process.env.PDF_SIGNING_P12_PASSWORD;
  if (!p12Base64 || !password) throw new Error("PDF signing isn't configured");

  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: "Signed via SealMe",
    contactInfo: "hello@sealme.net",
    name: opts.signerName,
    location: "",
    signingTime: opts.signedAt,
  });

  const p12Buffer = Buffer.from(p12Base64, "base64");
  const signer = new P12Signer(p12Buffer, { passphrase: password });
  return signpdf.sign(withPlaceholder, signer);
}
