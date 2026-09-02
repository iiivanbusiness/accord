import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { buildSlackAuthorizeUrl, isSlackConfigured } from "@/lib/slack";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    await requirePermission("canManageWorkspace");
  } catch {
    return NextResponse.redirect(new URL("/settings?error=slack_no_permission", req.url));
  }

  if (!isSlackConfigured()) return NextResponse.redirect(new URL("/settings?error=slack_not_configured", req.url));
  return NextResponse.redirect(buildSlackAuthorizeUrl());
}
