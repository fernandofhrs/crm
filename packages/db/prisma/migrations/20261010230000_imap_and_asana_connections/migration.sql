-- AlterTable
ALTER TABLE "activity" ADD COLUMN "asanaTaskGid" TEXT;

-- AlterTable
ALTER TABLE "emailMessage" ADD COLUMN "imapMessageRef" TEXT;

-- CreateTable
CREATE TABLE "imapConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imapConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asanaConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "accountName" TEXT,
    "projectGid" TEXT,
    "projectName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asanaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_asanaTaskGid_key" ON "activity"("asanaTaskGid");

-- CreateIndex
CREATE UNIQUE INDEX "imapConnection_userId_key" ON "imapConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "asanaConnection_userId_key" ON "asanaConnection"("userId");

-- AddForeignKey
ALTER TABLE "imapConnection" ADD CONSTRAINT "imapConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asanaConnection" ADD CONSTRAINT "asanaConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
