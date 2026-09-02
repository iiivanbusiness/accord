import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";
import { ContractPdfDocument } from "@/lib/contract-pdf";
import { embedTamperEvidentSignature, isPdfSigningConfigured } from "@/lib/pdf-sign";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { deal: { include: { client: true, fields: true, workspace: true } }, template: true },
  });
  if (!contract || !contract.template) {
    return new NextResponse("Not found", { status: 404 });
  }

  const clauses = fillClauses(contract.template.clauses, contract.deal.fields);
  let buffer = await renderToBuffer(
    <ContractPdfDocument
      templateName={contract.template.name}
      agencyName={contract.deal.workspace.name}
      agencyLogo={contract.deal.workspace.logoImage}
      clientName={contract.deal.client.name}
      clauses={clauses}
      signedBy={contract.signerName}
      signedAt={contract.signedAt}
      signatureImage={contract.signatureImage}
    />
  );

  // Once the client has actually signed (fully or waiting on a
  // counter-signer), embed a real PKI digital signature into the PDF
  // itself — tamper-evidence any standard reader can verify on its own.
  // A draft/unsent contract has nothing worth sealing yet.
  const isAnySigned = contract.status === "signed" || contract.status === "partially_signed";
  if (isAnySigned && contract.signerName && contract.signedAt && isPdfSigningConfigured()) {
    try {
      buffer = await embedTamperEvidentSignature(buffer, { signerName: contract.signerName, signedAt: contract.signedAt });
    } catch (err) {
      console.error(`Failed to embed digital signature for contract ${contract.id}`, err);
      // Fall through and serve the unsigned-certificate PDF rather than
      // failing the download entirely — the visual signature/audit trail
      // still stand on their own.
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${contract.template.name.replace(/\s+/g, "-")}-${contract.deal.client.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
