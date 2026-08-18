-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Growth',
    "callsUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "callsLimit" INTEGER NOT NULL DEFAULT 15,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSigned" BOOLEAN NOT NULL DEFAULT true,
    "autoRemind" BOOLEAN NOT NULL DEFAULT false,
    "zoomConnected" BOOLEAN NOT NULL DEFAULT true,
    "meetConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Workspace" ("callsLimit", "callsUsedThisMonth", "createdAt", "id", "name", "plan") SELECT "callsLimit", "callsUsedThisMonth", "createdAt", "id", "name", "plan" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
