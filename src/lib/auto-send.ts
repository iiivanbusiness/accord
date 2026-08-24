import { prisma } from "@/lib/db";
import { sendContractEmail } from "@/lib/email";

// Used when a workspace has "Require manual approval before sending" turned off:
// once a live call finishes with every required field captured, the contract
// goes out on its own — nobody has to click through Generate → Send.
export async function autoGenerateAndSendContract(dealId: string): Promise<boolean> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { client: true, template: true, workspace: { include: { users: true } }, contract: true },
  });
  if (!deal || !deal.template || !deal.client.email) return false;
  if (deal.status === "sent" || deal.status === "signed") return false;

  const contract = await prisma.contract.upsert({
    where: { dealId },
    create: { dealId, templateId: deal.templateId, status: "draft" },
    update: {},
  });

  const signLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign/${contract.id}`;
  const replyTo = deal.workspace.users[0]?.email ?? null;
  const verifiedSenderEmail = deal.workspace.senderDomainStatus === "verified" ? deal.workspace.senderEmail : null;
  const firstName = deal.client.name.split(" ")[0];

  await sendContractEmail({
    to: deal.client.email,
    subject: `${deal.template.name} from ${deal.workspace.name}`,
    message: `Hi ${firstName},\n\nThanks again for the call — here's the ${deal.template.name.toLowerCase()} we discussed. Take a look and sign whenever you're ready.\n\nLet me know if anything needs adjusting.`,
    signLink,
    workspaceName: deal.workspace.name,
    replyTo,
    verifiedSenderEmail,
  });

  await prisma.contract.update({ where: { dealId }, data: { status: "sent", sentAt: new Date() } });
  await prisma.deal.update({ where: { id: dealId }, data: { status: "sent" } });
  return true;
}
