-- HubSpot switched from a shared OAuth app to a per-workspace Private App
-- token (see the Workspace model doc comment) — the OAuth refresh fields
-- are no longer needed. Confirmed unused (0 workspaces had
-- hubspotRefreshToken set) before dropping.
ALTER TABLE "Workspace" DROP COLUMN "hubspotRefreshToken";
ALTER TABLE "Workspace" DROP COLUMN "hubspotTokenExpiresAt";
