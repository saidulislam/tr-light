-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvidenceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'POSITIVE',
    "body" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidenceEntry_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EvidenceEntry" ("authorId", "body", "createdAt", "dimension", "id", "reviewId", "type", "updatedAt") SELECT "authorId", "body", "createdAt", "dimension", "id", "reviewId", "type", "updatedAt" FROM "EvidenceEntry";
DROP TABLE "EvidenceEntry";
ALTER TABLE "new_EvidenceEntry" RENAME TO "EvidenceEntry";
CREATE INDEX "EvidenceEntry_reviewId_dimension_createdAt_idx" ON "EvidenceEntry"("reviewId", "dimension", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
