-- CreateEnum
CREATE TYPE "MirrorEntity" AS ENUM ('COMPANY', 'CONTACT', 'DEAL', 'ACTIVITY');

-- CreateTable
CREATE TABLE "mirrorRecord" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entity" "MirrorEntity" NOT NULL,
    "externalId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mirrorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mirrorRecord_companyId_idx" ON "mirrorRecord"("companyId");

-- CreateIndex
CREATE INDEX "mirrorRecord_contactId_idx" ON "mirrorRecord"("contactId");

-- CreateIndex
CREATE INDEX "mirrorRecord_dealId_idx" ON "mirrorRecord"("dealId");

-- CreateIndex
CREATE INDEX "mirrorRecord_activityId_idx" ON "mirrorRecord"("activityId");

-- CreateIndex
CREATE INDEX "mirrorRecord_source_ownerEmail_idx" ON "mirrorRecord"("source", "ownerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "mirrorRecord_source_entity_externalId_key" ON "mirrorRecord"("source", "entity", "externalId");

-- AddForeignKey
ALTER TABLE "mirrorRecord" ADD CONSTRAINT "mirrorRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirrorRecord" ADD CONSTRAINT "mirrorRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirrorRecord" ADD CONSTRAINT "mirrorRecord_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirrorRecord" ADD CONSTRAINT "mirrorRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
