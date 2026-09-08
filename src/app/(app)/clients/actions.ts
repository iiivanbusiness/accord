"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// A client itself isn't owned the way a Deal is, so there's no ownerId to
// check directly — visibility instead means "this user can see at least
// one deal with this client" (the same rule ClientsPage already filters
// its list by), keeping edit access exactly as wide as read access.
async function requireVisibleClient(clientId: string) {
  const { where: dealWhere } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId, deals: { some: dealWhere } },
  });
  if (!client) throw new Error("Client not found");
  return { client, workspaceId };
}

export async function updateClientDetails(clientId: string, formData: FormData): Promise<void> {
  const { workspaceId } = await requireVisibleClient(clientId);

  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim();
  if (!name) throw new Error("Name is required");
  if (!company) throw new Error("Company is required");

  await prisma.client.update({
    where: { id: clientId },
    data: {
      name,
      company,
      email: email || null,
      phone: phone || null,
      billingAddress: billingAddress || null,
    },
  });

  const session = await auth();
  await logAudit({ workspaceId, actorEmail: session?.user?.email, action: "client.updated", targetType: "Client", targetId: clientId });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}
