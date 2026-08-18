import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAuthorizeUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/calendar?error=google_not_configured", req.url));
  }
  return NextResponse.redirect(buildAuthorizeUrl());
}
