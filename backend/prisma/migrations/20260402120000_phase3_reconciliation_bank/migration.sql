-- Phase 3: subledger reconciliation, bank statements, optional Company on JournalEntry

CREATE TYPE "ReconciliationMatchType" AS ENUM ('STANDARD', 'WRITEOFF');

CREATE TYPE "BankStatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

ALTER TABLE "JournalEntry" ADD COLUMN "companyId" TEXT;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReconciliationMatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "debitJournalLineId" TEXT NOT NULL,
    "creditJournalLineId" TEXT NOT NULL,
    "amount" DECIMAL(18, 4) NOT NULL,
    "matchType" "ReconciliationMatchType" NOT NULL DEFAULT 'STANDARD',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationMatch_debitJournalLineId_idx" ON "ReconciliationMatch"("debitJournalLineId");

CREATE INDEX "ReconciliationMatch_creditJournalLineId_idx" ON "ReconciliationMatch"("creditJournalLineId");

CREATE INDEX "ReconciliationMatch_companyId_idx" ON "ReconciliationMatch"("companyId");

ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_debitJournalLineId_fkey" FOREIGN KEY ("debitJournalLineId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_creditJournalLineId_fkey" FOREIGN KEY ("creditJournalLineId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "cashBankId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceName" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankStatement_cashBankId_idx" ON "BankStatement"("cashBankId");

CREATE INDEX "BankStatement_companyId_idx" ON "BankStatement"("companyId");

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_cashBankId_fkey" FOREIGN KEY ("cashBankId") REFERENCES "CashBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18, 4) NOT NULL,
    "description" TEXT,
    "bankReference" TEXT,
    "rawPayload" JSONB,
    "status" "BankStatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedPaymentId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedById" TEXT,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankStatementLine_statementId_idx" ON "BankStatementLine"("statementId");

CREATE INDEX "BankStatementLine_matchedPaymentId_idx" ON "BankStatementLine"("matchedPaymentId");

CREATE UNIQUE INDEX "BankStatementLine_statementId_lineIndex_key" ON "BankStatementLine"("statementId", "lineIndex");

ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchedPaymentId_fkey" FOREIGN KEY ("matchedPaymentId") REFERENCES "TreasuryPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchedById_fkey" FOREIGN KEY ("matchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
