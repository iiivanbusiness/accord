import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { requireWorkspaceId } from "@/lib/workspace";
import { signOAuthState } from "@/lib/oauth-state";
import { buildDocusignAuthorizeUrl, canConnectDocusign, isDocusignConfigured } from "@/lib/docusign";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    await requirePermission("canManageWorkspace");
  } catch {
    return NextResponse.redirect(new URL("/settings?error=docusign_no_permission", req.url));
  }

  if (!isDocusignConfigured()) return NextResponse.redirect(new URL("/settings?error=docusign_not_configured", req.url));
  const workspaceId = await requireWorkspaceId();
  if (!canConnectDocusign(workspaceId)) return NextResponse.redirect(new URL("/settings?error=docusign_coming_soon", req.url));
  return NextResponse.redirect(buildDocusignAuthorizeUrl(await signOAuthState("docusign", workspaceId)));
}
