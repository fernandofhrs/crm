-- AlterTable
ALTER TABLE "asanaConnection" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "activity" ADD COLUMN "asanaSyncedById" TEXT;

UPDATE "activity" SET "asanaSyncedById" = "createdById" WHERE "asanaTaskGid" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "asanaConnection_shared_team_key" ON "asanaConnection"("shared") WHERE ("shared" = true);

-- CreateIndex
CREATE INDEX "activity_asanaSyncedById_idx" ON "activity"("asanaSyncedById");

-- CreateTable
CREATE TABLE "asanaAssignee" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "asanaUserGid" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asanaAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asanaAssignee_connectionId_asanaUserGid_key" ON "asanaAssignee"("connectionId", "asanaUserGid");

-- CreateIndex
CREATE INDEX "asanaAssignee_userId_idx" ON "asanaAssignee"("userId");

-- AddForeignKey
ALTER TABLE "asanaAssignee" ADD CONSTRAINT "asanaAssignee_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "asanaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asanaAssignee" ADD CONSTRAINT "asanaAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
