import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mintSessionCookie, ssoCallbackUrl, verifyIdToken, verifySsoState } from "@/lib/sso";
import { logAudit } from "@/lib/audit";

function loginError(message: string): NextResponse {
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login?error=${encodeURIComponent(message)}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idpError = url.searchParams.get("error");
  if (idpError) return loginError(`Sign-in was cancelled (${idpError})`);

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) return loginError("Missing sign-in parameters — try again");

  const state = await verifySsoState(stateParam);
  if (!state) return loginError("That sign-in link expired — try again");

  const workspace = await prisma.workspace.findUnique({ where: { id: state.workspaceId } });
  if (!workspace || !workspace.ssoEnabled || !workspace.ssoClientSecret) {
    return loginError("SSO is no longer enabled for that organization");
  }

  // Exchange the authorization code for an ID token — server-to-server,
  // the client secret never touches the browser.
  let tokenResponse: { id_token?: string };
  try {
    const res = await fetch(state.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: ssoCallbackUrl(),
        client_id: state.clientId,
        client_secret: workspace.ssoClientSecret,
        code_verifier: state.codeVerifier,
      }),
    });
    if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
    tokenResponse = await res.json();
  } catch (err) {
    console.error("SSO token exchange failed", err);
    return loginError("Couldn't complete sign-in with your identity provider");
  }
  if (!tokenResponse.id_token) return loginError("Identity provider didn't return an ID token");

  let claims: { email: string; name: string };
  try {
    claims = await verifyIdToken(tokenResponse.id_token, state.jwksUri, state.issuer, state.clientId, state.nonce);
  } catch (err) {
    console.error("SSO ID token verification failed", err);
    return loginError("Couldn't verify your identity provider's response");
  }

  if (!claims.email.endsWith(`@${workspace.allowedEmailDomain}`)) {
    return loginError("Your identity provider account isn't in this organization's domain");
  }

  let user = await prisma.user.findUnique({ where: { email: claims.email } });
  if (user && user.workspaceId !== workspace.id) {
    return loginError("That email is already tied to a different SealMe workspace");
  }

  if (!user) {
    // First SSO sign-in for this person — the IdP already vouches for who
    // they are (and its own app-assignment already gated who can even
    // reach this point), so there's no separate invite step. No role yet;
    // an admin assigns one afterward, same as a manually invited teammate.
    user = await prisma.user.create({
      data: { workspaceId: workspace.id, name: claims.name, email: claims.email, passwordHash: null, emailVerifiedAt: new Date() },
    });
    await logAudit({ workspaceId: workspace.id, actorEmail: claims.email, action: "teammate.sso_provisioned" });
  }

  if (user.deactivatedAt) {
    await logAudit({ workspaceId: workspace.id, actorEmail: claims.email, action: "login.failure", metadata: { reason: "deactivated", provider: "sso" } });
    return loginError("Your account has been deactivated — contact your IT team");
  }

  const cookie = await mintSessionCookie({ id: user.id, name: user.name, email: user.email, workspaceId: workspace.id });
  await logAudit({ workspaceId: workspace.id, actorEmail: claims.email, action: "login.success", metadata: { provider: "sso" } });

  const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
