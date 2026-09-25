import { encode as encodeJwt, decode as decodeJwt } from "next-auth/jwt";

// OAuth `state` for integrations whose callback stores tokens on the caller's
// workspace. Without it, anyone could send an admin a callback link carrying
// the attacker's own `code` and silently connect the attacker's account.
// (salesforce.ts has its own variant because its state also carries the PKCE
// verifier.)

type Provider = "slack" | "docusign" | "google-calendar";

const MAX_AGE_SECONDS = 10 * 60;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

export function signOAuthState(provider: Provider, workspaceId: string): Promise<string> {
  return encodeJwt({ token: { workspaceId }, secret: authSecret(), salt: `${provider}-oauth-state`, maxAge: MAX_AGE_SECONDS });
}

export async function isValidOAuthState(provider: Provider, state: string | null, workspaceId: string): Promise<boolean> {
  if (!state) return false;
  try {
    const payload = await decodeJwt<{ workspaceId?: unknown }>({ token: state, secret: authSecret(), salt: `${provider}-oauth-state` });
    return payload?.workspaceId === workspaceId;
  } catch {
    return false;
  }
}
