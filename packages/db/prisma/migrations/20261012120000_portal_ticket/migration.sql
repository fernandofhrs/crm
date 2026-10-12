-- CreateTable
CREATE TABLE "portalTicket" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portalTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portalTicket_expiresAt_idx" ON "portalTicket"("expiresAt");
