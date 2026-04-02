-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'CLEARANCE', 'SHIPPER', 'OTHER');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('OPEN', 'CLOSED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "IncomeOutcomeKind" AS ENUM ('EXPENSE', 'REVENUE');

-- CreateEnum
CREATE TYPE "AccountingDirection" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "balanceDisplay" TEXT,
    "saleDiscountDefault" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemNo" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "containerNo" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3),
    "arriveDate" TIMESTAMP(3),
    "isLoaded" BOOLEAN NOT NULL DEFAULT false,
    "centralPoint" TEXT,
    "sourceCountry" TEXT,
    "notes" TEXT,
    "contents" TEXT,
    "telexNo" TEXT,
    "asPridePartyId" TEXT,
    "officeCommissionPercent" DECIMAL(18,4),
    "cbmTransportPrice" DECIMAL(18,4),
    "chinaExchangeRate" DECIMAL(18,4),
    "status" "ContainerStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT,
    "clearanceCompanyId" TEXT,
    "shipperText" TEXT,
    "policyNo" TEXT,
    "shipDate" TIMESTAMP(3),
    "releaseExportFlag" BOOLEAN NOT NULL DEFAULT false,
    "weightTotal" DECIMAL(18,4),
    "cartonsTotal" INTEGER,
    "profit" DECIMAL(18,4),
    "received" BOOLEAN NOT NULL DEFAULT false,
    "release" TEXT,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "axis" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerLineItem" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "realPrice" DECIMAL(18,6),
    "pieceTransport" DECIMAL(18,6),
    "weightSum" DECIMAL(18,6),
    "weight" DECIMAL(18,6),
    "cbmSum" DECIMAL(18,6),
    "cbm" DECIMAL(18,6),
    "priceToCustomerSum" DECIMAL(18,6),
    "priceToCustomer" DECIMAL(18,6),
    "boxes" INTEGER,
    "pieces" DECIMAL(18,6),
    "byPriceSum" DECIMAL(18,6),
    "cartonPcs" DECIMAL(18,6),
    "byPrice" DECIMAL(18,6),
    "itemName" TEXT,
    "itemNo" TEXT,
    "hasItem" BOOLEAN NOT NULL DEFAULT false,
    "itemId" TEXT,

    CONSTRAINT "ContainerLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerCostLine" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "description" TEXT,

    CONSTRAINT "ContainerCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoiceVoucher" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "voucherDate" TIMESTAMP(3),
    "exchangeRate" DECIMAL(18,6),
    "officeCommission" DECIMAL(18,4),
    "cbmTransportPrice" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT U&'\062F\0648\0644\0627\0631',
    "containerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "storeId" TEXT,
    "notes" TEXT,
    "phoneBalanceText" TEXT,
    "summation" DECIMAL(18,4),
    "paid" DECIMAL(18,4) DEFAULT 0,
    "balance" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoiceVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseVoucherLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "priceToCustomerSum" DECIMAL(18,6),
    "weightSum" DECIMAL(18,6),
    "weight" DECIMAL(18,6),
    "cbmSum" DECIMAL(18,6),
    "cbm" DECIMAL(18,6),
    "boxesSum" DECIMAL(18,6),
    "piecesSum" DECIMAL(18,6),
    "priceSum" DECIMAL(18,6),
    "cartonPcs" DECIMAL(18,6),
    "unitPrice" DECIMAL(18,6),
    "itemName" TEXT,
    "itemNo" TEXT,

    CONSTRAINT "PurchaseVoucherLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleVoucher" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "voucherDate" TIMESTAMP(3),
    "exchangeRate" DECIMAL(18,6),
    "officeCommission" DECIMAL(18,4),
    "cbmTransportPrice" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT U&'\062F\0648\0644\0627\0631',
    "containerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT,
    "notes" TEXT,
    "total" DECIMAL(18,4),
    "paid" DECIMAL(18,4) DEFAULT 0,
    "remaining" DECIMAL(18,4),
    "profit" DECIMAL(18,4),
    "accountingDebit" DECIMAL(18,4),
    "accountingCredit" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleVoucherLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "usdConvertRate" DECIMAL(18,6),
    "usdSumCol" DECIMAL(18,6),
    "usdPriceCol" DECIMAL(18,6),
    "cbmSumCol" DECIMAL(18,6),
    "weight" DECIMAL(18,6),
    "cbm1" DECIMAL(18,6),
    "cbm2" DECIMAL(18,6),
    "listQty" DECIMAL(18,6),
    "pricePerThousand" DECIMAL(18,6),
    "totalPrice" DECIMAL(18,6),
    "pcsInCarton" DECIMAL(18,6),
    "linePrice" DECIMAL(18,6),
    "detail" TEXT,
    "itemNo" TEXT,

    CONSTRAINT "SaleVoucherLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeOutcomeEntry" (
    "id" TEXT NOT NULL,
    "kind" "IncomeOutcomeKind" NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT U&'\062F\0648\0644\0627\0631',
    "documentNo" TEXT,
    "fees" DECIMAL(18,4),
    "usdAmount" DECIMAL(18,4),
    "detailsText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeOutcomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingMove" (
    "id" TEXT NOT NULL,
    "moveDate" TIMESTAMP(3) NOT NULL,
    "reportFrom" TIMESTAMP(3),
    "reportTo" TIMESTAMP(3),
    "exchangeRate" DECIMAL(18,6),
    "topCurrency" TEXT NOT NULL DEFAULT U&'\062F\0648\0644\0627\0631',
    "searchQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingLine" (
    "id" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "direction" "AccountingDirection" NOT NULL,
    "panelCurrency" TEXT NOT NULL DEFAULT U&'\062F\0648\0644\0627\0631',
    "dinar" DECIMAL(18,4),
    "jineh" DECIMAL(18,4),
    "usd" DECIMAL(18,4),
    "rmb" DECIMAL(18,4),
    "lineNo" TEXT,
    "details" TEXT,
    "lineDate" TIMESTAMP(3),

    CONSTRAINT "AccountingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialDocument" (
    "id" TEXT NOT NULL,
    "serial1" TEXT,
    "serial2" TEXT,
    "serial3" TEXT,
    "recipient" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "printAddr" TEXT NOT NULL DEFAULT 'pride',
    "printType" TEXT NOT NULL DEFAULT 'with',
    "hideNumDate" BOOLEAN NOT NULL DEFAULT false,
    "party1Name" TEXT,
    "party1Address" TEXT,
    "party2Name" TEXT,
    "party2Address" TEXT,
    "party3Name" TEXT,
    "party3Address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRateSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Container_containerNo_key" ON "Container"("containerNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoiceVoucher_voucherNo_currency_key" ON "PurchaseInvoiceVoucher"("voucherNo", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "SaleVoucher_voucherNo_currency_key" ON "SaleVoucher"("voucherNo", "currency");

-- CreateIndex
CREATE INDEX "IncomeOutcomeEntry_entryDate_currency_kind_idx" ON "IncomeOutcomeEntry"("entryDate", "currency", "kind");

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_clearanceCompanyId_fkey" FOREIGN KEY ("clearanceCompanyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerLineItem" ADD CONSTRAINT "ContainerLineItem_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerLineItem" ADD CONSTRAINT "ContainerLineItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerCostLine" ADD CONSTRAINT "ContainerCostLine_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceVoucher" ADD CONSTRAINT "PurchaseInvoiceVoucher_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceVoucher" ADD CONSTRAINT "PurchaseInvoiceVoucher_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceVoucher" ADD CONSTRAINT "PurchaseInvoiceVoucher_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseVoucherLine" ADD CONSTRAINT "PurchaseVoucherLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "PurchaseInvoiceVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVoucher" ADD CONSTRAINT "SaleVoucher_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVoucher" ADD CONSTRAINT "SaleVoucher_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVoucher" ADD CONSTRAINT "SaleVoucher_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVoucherLine" ADD CONSTRAINT "SaleVoucherLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "SaleVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingLine" ADD CONSTRAINT "AccountingLine_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "AccountingMove"("id") ON DELETE CASCADE ON UPDATE CASCADE;

