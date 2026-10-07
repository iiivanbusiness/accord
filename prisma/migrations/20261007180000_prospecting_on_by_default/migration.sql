-- Leads, tasks and calls are on for every workspace.
ALTER TABLE "Workspace" ALTER COLUMN "prospectingEnabled" SET DEFAULT true;
UPDATE "Workspace" SET "prospectingEnabled" = true WHERE "prospectingEnabled" = false;
