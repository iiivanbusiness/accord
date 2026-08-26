CREATE TABLE "OnboardingProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "callVolume" TEXT NOT NULL,
    "handoff" TEXT NOT NULL,
    "biggestProblem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingProfile_workspaceId_key" ON "OnboardingProfile"("workspaceId");

ALTER TABLE "OnboardingProfile" ADD CONSTRAINT "OnboardingProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
