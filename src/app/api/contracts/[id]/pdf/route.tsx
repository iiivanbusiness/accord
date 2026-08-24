import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";
import { ContractPdfDocument } from "@/lib/contract-pdf";

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
  const buffer = await renderToBuffer(
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${contract.template.name.replace(/\s+/g, "-")}-${contract.deal.client.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
