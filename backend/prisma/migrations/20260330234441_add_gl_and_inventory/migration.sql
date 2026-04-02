-- CreateEnum
CREATE TYPE "GlAccountClass" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'CONTAINER', 'SALE_VOUCHER', 'PURCHASE_VOUCHER', 'INCOME_OUTCOME', 'INVENTORY', 'OPENING_BALANCE', 'PAYMENT', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('OPENING', 'PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT');

-- CreateTable
CREATE TABLE "GlAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "class" "GlAccountClass" NOT NULL,
    "parentId" TEXT,
    "isPosting" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "entryNo" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "partyId" TEXT,
    "containerId" TEXT,
    "storeId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "debitBase" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "creditBase" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvWarehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "storeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvStockMove" (
    "id" TEXT NOT NULL,
    "moveDate" TIMESTAMP(3) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "StockMoveType" NOT NULL,
    "qty" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "totalCost" DECIMAL(18,4) NOT NULL,
    "referenceKind" "JournalSourceType" NOT NULL DEFAULT 'OTHER',
    "referenceId" TEXT,

    CONSTRAINT "InvStockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvStockBalance" (
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyOnHand" DECIMAL(18,6) NOT NULL,
    "avgUnitCost" DECIMAL(18,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvStockBalance_pkey" PRIMARY KEY ("warehouseId","itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlAccount_code_key" ON "GlAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_yearId_index_key" ON "FiscalPeriod"("yearId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryNo_key" ON "JournalEntry"("entryNo");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_partyId_idx" ON "JournalLine"("partyId");

-- CreateIndex
CREATE INDEX "JournalLine_containerId_idx" ON "JournalLine"("containerId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "InvWarehouse_code_key" ON "InvWarehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InvWarehouse_storeId_key" ON "InvWarehouse"("storeId");

-- CreateIndex
CREATE INDEX "InvStockMove_warehouseId_moveDate_idx" ON "InvStockMove"("warehouseId", "moveDate");

-- CreateIndex
CREATE INDEX "InvStockMove_itemId_idx" ON "InvStockMove"("itemId");

-- AddForeignKey
ALTER TABLE "GlAccount" ADD CONSTRAINT "GlAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvWarehouse" ADD CONSTRAINT "InvWarehouse_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvStockMove" ADD CONSTRAINT "InvStockMove_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InvWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvStockMove" ADD CONSTRAINT "InvStockMove_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvStockBalance" ADD CONSTRAINT "InvStockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InvWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvStockBalance" ADD CONSTRAINT "InvStockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
