-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "bankAutoRecord" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bankIncomeAccountId" TEXT,
ADD COLUMN     "bankToken" TEXT;

-- CreateTable
CREATE TABLE "BankAlert" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER,
    "counterparty" TEXT,
    "bankName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawText" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SHORTCUT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dedupKey" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "offeringId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAlert_offeringId_key" ON "BankAlert"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAlert_expenseId_key" ON "BankAlert"("expenseId");

-- CreateIndex
CREATE INDEX "BankAlert_churchId_status_occurredAt_idx" ON "BankAlert"("churchId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "BankAlert_churchId_counterparty_idx" ON "BankAlert"("churchId", "counterparty");

-- CreateIndex
CREATE UNIQUE INDEX "BankAlert_churchId_dedupKey_key" ON "BankAlert"("churchId", "dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "Church_bankToken_key" ON "Church"("bankToken");

-- AddForeignKey
ALTER TABLE "BankAlert" ADD CONSTRAINT "BankAlert_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAlert" ADD CONSTRAINT "BankAlert_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAlert" ADD CONSTRAINT "BankAlert_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

