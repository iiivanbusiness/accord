import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { buildDocusignAuthorizeUrl, isDocusignConfigured } from "@/lib/docusign";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    await requirePermission("canManageWorkspace");
  } catch {
    return NextResponse.redirect(new URL("/settings?error=docusign_no_permission", req.url));
  }

  if (!isDocusignConfigured()) return NextResponse.redirect(new URL("/settings?error=docusign_not_configured", req.url));
  return NextResponse.redirect(buildDocusignAuthorizeUrl());
}
