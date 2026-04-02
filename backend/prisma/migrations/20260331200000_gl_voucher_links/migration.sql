-- AlterTable
ALTER TABLE "SaleVoucher" ADD COLUMN "glJournalEntryId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseInvoiceVoucher" ADD COLUMN "glJournalEntryId" TEXT;

-- AlterTable
ALTER TABLE "IncomeOutcomeEntry" ADD COLUMN "glJournalEntryId" TEXT;

CREATE UNIQUE INDEX "SaleVoucher_glJournalEntryId_key" ON "SaleVoucher"("glJournalEntryId");

CREATE UNIQUE INDEX "PurchaseInvoiceVoucher_glJournalEntryId_key" ON "PurchaseInvoiceVoucher"("glJournalEntryId");

CREATE UNIQUE INDEX "IncomeOutcomeEntry_glJournalEntryId_key" ON "IncomeOutcomeEntry"("glJournalEntryId");

ALTER TABLE "SaleVoucher" ADD CONSTRAINT "SaleVoucher_glJournalEntryId_fkey" FOREIGN KEY ("glJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoiceVoucher" ADD CONSTRAINT "PurchaseInvoiceVoucher_glJournalEntryId_fkey" FOREIGN KEY ("glJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncomeOutcomeEntry" ADD CONSTRAINT "IncomeOutcomeEntry_glJournalEntryId_fkey" FOREIGN KEY ("glJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
