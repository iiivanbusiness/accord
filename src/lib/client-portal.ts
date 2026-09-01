import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

// A client's portal link is a stable, bookmarkable URL — not a short-lived
// single-use credential — so it's stored plain, the same trust model as a
// Contract's own id used directly in /sign/[id]. Idempotent: returns the
// existing token if one was already minted for this client.
export async function getOrMintPortalToken(clientId: string): Promise<string> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (client.portalToken) return client.portalToken;

  const token = randomBytes(24).toString("hex");
  await prisma.client.update({ where: { id: clientId }, data: { portalToken: token } });
  return token;
}
