-- CreateTable
CREATE TABLE "QuintileAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewPeriodId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "rankInGrade" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuintileAssignment_reviewPeriodId_fkey" FOREIGN KEY ("reviewPeriodId") REFERENCES "ReviewPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuintileAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuintileMove" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewPeriodId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "fromRank" INTEGER,
    "toRank" INTEGER NOT NULL,
    "fromQuintile" INTEGER,
    "toQuintile" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "movedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuintileMove_reviewPeriodId_fkey" FOREIGN KEY ("reviewPeriodId") REFERENCES "ReviewPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuintileMove_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuintileMove_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuintileAssignment_reviewPeriodId_subjectId_idx" ON "QuintileAssignment"("reviewPeriodId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuintileAssignment_reviewPeriodId_subjectId_key" ON "QuintileAssignment"("reviewPeriodId", "subjectId");

-- CreateIndex
CREATE INDEX "QuintileMove_reviewPeriodId_subjectId_idx" ON "QuintileMove"("reviewPeriodId", "subjectId");

-- CreateIndex
CREATE INDEX "QuintileMove_createdAt_idx" ON "QuintileMove"("createdAt");
