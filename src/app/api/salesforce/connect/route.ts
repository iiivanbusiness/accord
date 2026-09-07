import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { requireWorkspaceId } from "@/lib/workspace";
import { buildSalesforceAuthorizeUrl, isSalesforceConfigured } from "@/lib/salesforce";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    await requirePermission("canManageWorkspace");
  } catch {
    return NextResponse.redirect(new URL("/settings?error=salesforce_no_permission", req.url));
  }

  if (!isSalesforceConfigured()) return NextResponse.redirect(new URL("/settings?error=salesforce_not_configured", req.url));
  const workspaceId = await requireWorkspaceId();
  return NextResponse.redirect(await buildSalesforceAuthorizeUrl(workspaceId));
}
