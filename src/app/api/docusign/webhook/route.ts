import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { finalizeContractSigned } from "@/lib/signing";

type ConnectPayload = {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: { status?: string; sentDateTime?: string; completedDateTime?: string; recipients?: { signers?: { name?: string; email?: string; routingOrder?: string; status?: string; signedDateTime?: string }[] } };
  };
};

function verifySignature(rawBody: string, signatureHeader: string | null, hmacKey: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", hmacKey).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

// DocuSign Connect POSTs here whenever a subscribed envelope event fires
// (see createConnectSubscription — only "completed" is subscribed).
// Verifies the HMAC signature DocuSign signs the body with, finds the
// matching contract by envelopeId, and runs the same finalize path the
// SealMe-native signing flow uses once every signer's done.
export async function POST(req: Request) {
  const rawBody = await req.text();

  const hmacKey = process.env.DOCUSIGN_CONNECT_HMAC_KEY;
  if (hmacKey) {
    const signature = req.headers.get("x-docusign-signature-1");
    if (!verifySignature(rawBody, signature, hmacKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: ConnectPayload;
  try {
    payload = JSON.parse(rawBody) as ConnectPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const envelopeId = payload.data?.envelopeId;
  const status = payload.data?.envelopeSummary?.status;
  if (!envelopeId || status !== "completed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const contract = await prisma.contract.findFirst({ where: { docusignEnvelopeId: envelopeId } });
  if (!contract) return NextResponse.json({ ok: true, skipped: true });
  if (contract.status === "signed") return NextResponse.json({ ok: true, alreadySigned: true });

  const signers = payload.data?.envelopeSummary?.recipients?.signers ?? [];
  const primary = signers.find((s) => s.routingOrder === "1") ?? signers[0];

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      signerName: primary?.name ?? "Client",
      signedAt: primary?.signedDateTime ? new Date(primary.signedDateTime) : new Date(),
    },
  });
  // DocuSign already confirmed every recipient signed (that's what
  // "completed" means) — our own ContractSigner rows exist for
  // record-keeping/UI consistency, not as a second gate.
  await prisma.contractSigner.updateMany({ where: { contractId: contract.id, status: "pending" }, data: { status: "signed", signedAt: new Date() } });

  await finalizeContractSigned(contract.id);

  return NextResponse.json({ ok: true });
}
