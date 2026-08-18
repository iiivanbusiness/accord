import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, getUserEmail } from "@/lib/google-calendar";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/calendar?error=google_${error}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/calendar?error=google_no_code", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getUserEmail(tokens.access_token);

    const workspace = await prisma.workspace.findFirst();
    if (!workspace) throw new Error("No workspace found");

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token ?? workspace.googleRefreshToken,
        googleTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        googleAccountEmail: email,
      },
    });

    return NextResponse.redirect(new URL("/calendar?connected=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/calendar?error=google_token_exchange", req.url));
  }
}
