import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import * as fin from "./financeService.js";
import * as saleSvc from "./saleVoucherService.js";
import * as purchaseSvc from "./purchaseVoucherService.js";
import * as inv from "./inventoryStockService.js";
import {
  buildInputVatMapFromPurchaseLines,
  buildOutputVatMapFromSaleLines,
  buildPurchaseInvoiceGlLines,
  buildSaleInvoiceGlLines,
} from "../domain/accounting/AccountingEngine.js";
import * as wf from "./workflowService.js";

function amt(n: Prisma.Decimal | number | null | undefined): Prisma.Decimal {
  if (n == null) return new Prisma.Decimal(0);
  if (n instanceof Prisma.Decimal) return n;
  return new Prisma.Decimal(String(n));
}

async function resolveExchangeMultiplier(currency: string, exchangeRate: Prisma.Decimal | null | undefined) {
  if (currency === "دولار") return amt(1);
  if (exchangeRate && Number(exchangeRate) > 0) return amt(exchangeRate);
  const latest = await prisma.exchangeRateSnapshot.findFirst({
    where: { label: currency },
    orderBy: { asOf: "desc" },
  });
  if (latest && Number(latest.rate) > 0) return amt(latest.rate);
  throw new AppError(400, `Missing exchange rate for currency: ${currency}`);
}

export async function postSaleVoucherToGl(
  voucherId: string,
  body: {
    arAccountId: string;
    revenueAccountId: string;
    cogsAccountId?: string;
    inventoryAccountId?: string;
    /** عند وجود ضريبة بسطر دون TaxRate.outputVatAccountId */
    defaultOutputVatAccountId?: string;
  },
  userId?: string,
) {
  if ((body.cogsAccountId && !body.inventoryAccountId) || (!body.cogsAccountId && body.inventoryAccountId)) {
    throw new AppError(400, "Both cogsAccountId and inventoryAccountId must be provided together");
  }
  await saleSvc.saleVoucherTotals(voucherId);
  const v = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Sale voucher not found");
  wf.assertCanPostSaleVoucher({
    id: v.id,
    documentStatus: v.documentStatus,
    glJournalEntryId: v.glJournalEntryId,
  });
  if (v.glJournalEntryId) throw new AppError(409, "Voucher already posted to GL");
  const existingJe = await prisma.journalEntry.findFirst({
    where: { sourceType: "SALE_VOUCHER", sourceId: voucherId, voidedAt: null },
    select: { id: true },
  });
  if (existingJe) throw new AppError(409, "Voucher already posted to GL");
  const amount = amt(v.total);
  if (amount.lte(0)) throw new AppError(400, "Invoice total must be > 0 to post");
  const exchangeMultiplier = await resolveExchangeMultiplier(v.currency, v.exchangeRate);
  const entryDate = v.voucherDate ?? new Date();
  const desc = `فاتورة بيع ${v.voucherNo}`;

  return prisma.$transaction(async (tx) => {
    const txVoucher = await tx.saleVoucher.findUnique({
      where: { id: voucherId },
      select: { glJournalEntryId: true },
    });
    if (!txVoucher) throw new AppError(404, "Sale voucher not found");
    if (txVoucher.glJournalEntryId) throw new AppError(409, "Voucher already posted to GL");
    const txJe = await tx.journalEntry.findFirst({
      where: { sourceType: "SALE_VOUCHER", sourceId: voucherId, voidedAt: null },
      select: { id: true },
    });
    if (txJe) throw new AppError(409, "Voucher already posted to GL");
    await inv.applySaleVoucherInventory(tx, voucherId, entryDate);
    const invMoves = await tx.invStockMove.findMany({
      where: { referenceKind: "SALE_VOUCHER", referenceId: voucherId },
      select: { totalCost: true },
    });
    const cogs = invMoves.reduce((s, m) => s.add(amt(m.totalCost)), amt(0));

    const linesWithTax = await tx.saleVoucherLine.findMany({
      where: { voucherId },
      orderBy: { seq: "asc" },
      include: { taxRate: true },
    });
    const vatMap = buildOutputVatMapFromSaleLines(linesWithTax, body.defaultOutputVatAccountId ?? null);

    const glLines = buildSaleInvoiceGlLines({
      description: desc,
      customerId: v.customerId,
      containerId: v.containerId,
      docTotal: amount,
      exchangeMultiplier,
      arAccountId: body.arAccountId,
      revenueAccountId: body.revenueAccountId,
      outputVatByAccount: vatMap,
      cogsPair:
        body.cogsAccountId && body.inventoryAccountId && cogs.gt(0)
          ? {
              cogsAccountId: body.cogsAccountId,
              inventoryAccountId: body.inventoryAccountId,
              cogsAmount: cogs,
            }
          : undefined,
    });

    const je = await fin.createPostedJournal(
      {
        entryDate,
        description: desc,
        sourceType: "SALE_VOUCHER",
        sourceId: voucherId,
        lines: glLines,
        userId,
      },
      tx,
    );
    const linked = await tx.saleVoucher.updateMany({
      where: { id: voucherId, glJournalEntryId: null },
      data: { glJournalEntryId: je.id, documentStatus: "POSTED" },
    });
    if (linked.count !== 1) throw new AppError(409, "Voucher already posted to GL");
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "POST_SALE_VOUCHER_GL",
        entityType: "SaleVoucher",
        entityId: voucherId,
        details: { journalEntryId: je.id, entryNo: je.entryNo },
      },
    });
    await fin.assertTrialBalanceBalanced(
      tx,
      je.period.startDate,
      je.period.endDate,
      "sale voucher posting",
    );
    return je;
  });
}

export async function postPurchaseVoucherToGl(
  voucherId: string,
  body: { debitAccountId: string; apAccountId: string; defaultInputVatAccountId?: string },
  userId?: string,
) {
  await purchaseSvc.purchaseVoucherTotals(voucherId);
  const v = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Purchase voucher not found");
  wf.assertCanPostPurchaseVoucher({
    id: v.id,
    documentStatus: v.documentStatus,
    glJournalEntryId: v.glJournalEntryId,
  });
  if (v.glJournalEntryId) throw new AppError(409, "Voucher already posted to GL");
  const existingJe = await prisma.journalEntry.findFirst({
    where: { sourceType: "PURCHASE_VOUCHER", sourceId: voucherId, voidedAt: null },
    select: { id: true },
  });
  if (existingJe) throw new AppError(409, "Voucher already posted to GL");
  const amount = amt(v.summation);
  if (amount.lte(0)) throw new AppError(400, "Purchase summation must be > 0 to post");
  const entryDate = v.voucherDate ?? new Date();
  const desc = `فاتورة شراء ${v.voucherNo}`;

  return prisma.$transaction(async (tx) => {
    const txVoucher = await tx.purchaseInvoiceVoucher.findUnique({
      where: { id: voucherId },
      select: { glJournalEntryId: true },
    });
    if (!txVoucher) throw new AppError(404, "Purchase voucher not found");
    if (txVoucher.glJournalEntryId) throw new AppError(409, "Voucher already posted to GL");
    const txJe = await tx.journalEntry.findFirst({
      where: { sourceType: "PURCHASE_VOUCHER", sourceId: voucherId, voidedAt: null },
      select: { id: true },
    });
    if (txJe) throw new AppError(409, "Voucher already posted to GL");

    const purchaseLines = await tx.purchaseVoucherLine.findMany({
      where: { voucherId },
      orderBy: { seq: "asc" },
      include: { taxRate: true },
    });
    const exchangeMultiplier = await resolveExchangeMultiplier(v.currency, v.exchangeRate);
    const inputVatMap = buildInputVatMapFromPurchaseLines(
      purchaseLines,
      body.defaultInputVatAccountId ?? null,
    );

    const glLines = buildPurchaseInvoiceGlLines({
      description: desc,
      supplierId: v.supplierId,
      containerId: v.containerId,
      docTotal: amount,
      exchangeMultiplier,
      expenseOrInventoryAccountId: body.debitAccountId,
      apAccountId: body.apAccountId,
      inputVatByAccount: inputVatMap.size ? inputVatMap : undefined,
    });

    const je = await fin.createPostedJournal(
      {
        entryDate,
        description: desc,
        sourceType: "PURCHASE_VOUCHER",
        sourceId: voucherId,
        lines: glLines,
        userId,
      },
      tx,
    );
    const linked = await tx.purchaseInvoiceVoucher.updateMany({
      where: { id: voucherId, glJournalEntryId: null },
      data: { glJournalEntryId: je.id, documentStatus: "POSTED" },
    });
    if (linked.count !== 1) throw new AppError(409, "Voucher already posted to GL");
    await inv.applyPurchaseVoucherInventory(tx, voucherId, entryDate);
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "POST_PURCHASE_VOUCHER_GL",
        entityType: "PurchaseInvoiceVoucher",
        entityId: voucherId,
        details: { journalEntryId: je.id, entryNo: je.entryNo },
      },
    });
    await fin.assertTrialBalanceBalanced(
      tx,
      je.period.startDate,
      je.period.endDate,
      "purchase voucher posting",
    );
    return je;
  });
}

export async function postIncomeOutcomeToGl(
  entryId: string,
  body: { cashAccountId: string; offsetAccountId: string },
  userId?: string,
) {
  const v = await prisma.incomeOutcomeEntry.findUnique({ where: { id: entryId } });
  if (!v) throw new AppError(404, "Entry not found");
  if (v.glJournalEntryId) throw new AppError(409, "Already posted to GL");
  const base = amt(v.usdAmount).add(amt(v.fees));
  if (base.lte(0)) throw new AppError(400, "Amount (usdAmount + fees) must be > 0");
  const entryDate = v.entryDate;
  const kindLabel = v.kind === "REVENUE" ? "إيراد" : "مصروف";
  const desc = `${kindLabel} ${v.documentNo ?? entryId}`;

  const lines =
    v.kind === "REVENUE"
      ? [
          { accountId: body.cashAccountId, debit: base.toString(), credit: "0", description: desc },
          { accountId: body.offsetAccountId, debit: "0", credit: base.toString(), description: desc },
        ]
      : [
          { accountId: body.offsetAccountId, debit: base.toString(), credit: "0", description: desc },
          { accountId: body.cashAccountId, debit: "0", credit: base.toString(), description: desc },
        ];

  return prisma.$transaction(async (tx) => {
    const je = await fin.createPostedJournal(
      {
        entryDate,
        description: desc,
        sourceType: "INCOME_OUTCOME",
        sourceId: entryId,
        lines,
        userId,
      },
      tx,
    );
    await tx.incomeOutcomeEntry.update({ where: { id: entryId }, data: { glJournalEntryId: je.id } });
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "POST_INCOME_OUTCOME_GL",
        entityType: "IncomeOutcomeEntry",
        entityId: entryId,
        details: { journalEntryId: je.id },
      },
    });
    await fin.assertTrialBalanceBalanced(
      tx,
      je.period.startDate,
      je.period.endDate,
      "income/outcome posting",
    );
    return je;
  });
}
