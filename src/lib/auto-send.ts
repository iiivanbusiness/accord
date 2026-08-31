import { prisma } from "@/lib/db";
import { requestOrSendContract } from "@/lib/approval";

// Used when a workspace has "Require manual approval before sending" turned off:
// once a live call finishes with every required field captured, the contract
// goes out on its own — nobody has to click through Generate → Send. If the
// workspace also has an approval chain configured, this still holds the
// contract for review instead of emailing the client — "no manual review of
// the extracted fields needed" and "nobody approved this contract yet" are
// separate gates.
export async function autoGenerateAndSendContract(dealId: string): Promise<boolean> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { client: true, template: true, workspace: true, contract: true },
  });
  if (!deal || !deal.template || !deal.client.email) return false;
  if (deal.status === "sent" || deal.status === "signed" || deal.status === "pending_approval") return false;

  await prisma.contract.upsert({
    where: { dealId },
    create: { dealId, templateId: deal.templateId, status: "draft" },
    update: {},
  });

  const firstName = deal.client.name.split(" ")[0];

  await requestOrSendContract(dealId, {
    to: deal.client.email,
    subject: `${deal.template.name} from ${deal.workspace.name}`,
    message: `Hi ${firstName},\n\nThanks again for the call — here's the ${deal.template.name.toLowerCase()} we discussed. Take a look and sign whenever you're ready.\n\nLet me know if anything needs adjusting.`,
  });

  return true;
}
