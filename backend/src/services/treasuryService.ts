import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import * as fin from "./financeService.js";
import { validatePaymentAllocations } from "../domain/accounting/paymentAllocation.js";
import * as wf from "./workflowService.js";

function d(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(String(v));
}

export async function listCashBanks() {
  return prisma.cashBankAccount.findMany({
    orderBy: { name: "asc" },
    include: { glAccount: { select: { id: true, code: true, name: true } } },
  });
}

export async function listPayments() {
  return prisma.treasuryPayment.findMany({
    orderBy: { paymentDate: "desc" },
    include: {
      party: { select: { id: true, name: true } },
      cashBank: { select: { id: true, name: true } },
      allocations: {
        include: {
          saleVoucher: { select: { id: true, voucherNo: true } },
          purchaseVoucher: { select: { id: true, voucherNo: true } },
        },
      },
    },
  });
}

async function recalcVoucherAllocationTotals(tx: Prisma.TransactionClient, paymentId: string) {
  const allocations = await tx.treasuryPaymentAllocation.findMany({
    where: { paymentId },
    select: { saleVoucherId: true, purchaseVoucherId: true },
  });
  const saleIds = [...new Set(allocations.map((a) => a.saleVoucherId).filter(Boolean) as string[])];
  const purchaseIds = [...new Set(allocations.map((a) => a.purchaseVoucherId).filter(Boolean) as string[])];

  for (const saleId of saleIds) {
    const agg = await tx.treasuryPaymentAllocation.aggregate({
      where: { saleVoucherId: saleId },
      _sum: { amount: true },
    });
    const paid = d(agg._sum.amount ?? 0);
    const sale = await tx.saleVoucher.findUnique({ where: { id: saleId }, select: { total: true } });
    const total = d(sale?.total ?? 0);
    await tx.saleVoucher.update({
      where: { id: saleId },
      data: {
        paid,
        remaining: total.minus(paid),
      },
    });
  }

  for (const purchaseId of purchaseIds) {
    const agg = await tx.treasuryPaymentAllocation.aggregate({
      where: { purchaseVoucherId: purchaseId },
      _sum: { amount: true },
    });
    const paid = d(agg._sum.amount ?? 0);
    const purchase = await tx.purchaseInvoiceVoucher.findUnique({
      where: { id: purchaseId },
      select: { summation: true },
    });
    const total = d(purchase?.summation ?? 0);
    await tx.purchaseInvoiceVoucher.update({
      where: { id: purchaseId },
      data: {
        paid,
        balance: total.minus(paid),
      },
    });
  }

  for (const saleId of saleIds) {
    await wf.markSaleVoucherPaidIfSettled(saleId, tx);
  }
  for (const purchaseId of purchaseIds) {
    await wf.markPurchaseVoucherPaidIfSettled(purchaseId, tx);
  }
}

export async function createCashBank(body: {
  name: string;
  kind?: string;
  glAccountId?: string | null;
}) {
  return prisma.cashBankAccount.create({
    data: {
      name: body.name.trim(),
      kind: body.kind?.trim() || "CASH",
      glAccountId: body.glAccountId ?? null,
    },
    include: { glAccount: true },
  });
}

export async function updateCashBank(
  id: string,
  body: Partial<{ name: string; kind: string; glAccountId: string | null; isActive: boolean }>,
) {
  return prisma.cashBankAccount.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.glAccountId !== undefined ? { glAccountId: body.glAccountId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: { glAccount: true },
  });
}

async function nextTreasuryDocNo(tx: Prisma.TransactionClient, prefix: string) {
  const key = `TREASURY_${prefix}`;
  const existing = await tx.documentSequence.findUnique({ where: { key } });
  if (!existing) await tx.documentSequence.create({ data: { key, prefix, nextNum: 1 } });
  const u = await tx.documentSequence.update({ where: { key }, data: { nextNum: { increment: 1 } } });
  return `${prefix}-${String(u.nextNum - 1).padStart(6, "0")}`;
}

/** إنشاء سند قبض/صرف + ترحيل محاسبي */
export async function createAndPostPayment(input: {
  paymentDate: Date;
  direction: "RECEIPT" | "DISBURSEMENT";
  partyId?: string | null;
  cashBankId: string;
  amount: Prisma.Decimal | number | string;
  offsetAccountId: string;
  notes?: string | null;
  allocations?: { saleVoucherId?: string | null; purchaseVoucherId?: string | null; amount: string | number }[];
  userId?: string;
}) {
  const amount = d(input.amount);
  if (amount.lte(0)) throw new AppError(400, "المبلغ يجب أن يكون موجباً");
  validatePaymentAllocations(amount, input.allocations);

  const bank = await prisma.cashBankAccount.findUnique({
    where: { id: input.cashBankId },
    include: { glAccount: true },
  });
  if (!bank) throw new AppError(404, "صندوق/بنك غير موجود");
  if (!bank.glAccountId || !bank.glAccount) {
    throw new AppError(400, "اربط حساباً محاسبياً بالصندوق/البنك أولاً");
  }

  return prisma.$transaction(async (tx) => {
    const docNo = await nextTreasuryDocNo(tx, input.direction === "RECEIPT" ? "REC" : "PAY");
    const payment = await tx.treasuryPayment.create({
      data: {
        docNo,
        paymentDate: input.paymentDate,
        direction: input.direction,
        partyId: input.partyId ?? null,
        cashBankId: input.cashBankId,
        amount,
        offsetAccountId: input.offsetAccountId,
        notes: input.notes?.trim() || null,
        allocations: input.allocations?.length
          ? {
              create: input.allocations.map((a) => ({
                saleVoucherId: a.saleVoucherId ?? null,
                purchaseVoucherId: a.purchaseVoucherId ?? null,
                amount: d(a.amount),
              })),
            }
          : undefined,
      },
      include: { allocations: true },
    });

    const desc =
      input.direction === "RECEIPT"
        ? `سند قبض ${docNo}`
        : `سند صرف ${docNo}`;

    const cashId = bank.glAccountId!;
    const lines =
      input.direction === "RECEIPT"
        ? [
            {
              accountId: cashId,
              debit: amount.toString(),
              credit: "0",
              partyId: input.partyId ?? undefined,
              description: desc,
            },
            {
              accountId: input.offsetAccountId,
              debit: "0",
              credit: amount.toString(),
              partyId: input.partyId ?? undefined,
              description: desc,
            },
          ]
        : [
            {
              accountId: input.offsetAccountId,
              debit: amount.toString(),
              credit: "0",
              partyId: input.partyId ?? undefined,
              description: desc,
            },
            {
              accountId: cashId,
              debit: "0",
              credit: amount.toString(),
              partyId: input.partyId ?? undefined,
              description: desc,
            },
          ];

    const je = await fin.createPostedJournal(
      {
        entryDate: input.paymentDate,
        description: desc,
        sourceType: "PAYMENT",
        sourceId: payment.id,
        lines,
        userId: input.userId,
      },
      tx,
    );

    await tx.treasuryPayment.update({
      where: { id: payment.id },
      data: { glJournalEntryId: je.id },
    });
    await recalcVoucherAllocationTotals(tx, payment.id);

    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "POST_TREASURY_PAYMENT",
        entityType: "TreasuryPayment",
        entityId: payment.id,
        details: { journalEntryId: je.id, docNo },
      },
    });

    return { payment: { ...payment, glJournalEntryId: je.id }, journalEntry: je };
  });
}

export async function createAndPostTransfer(input: {
  transferDate: Date;
  fromCashBankId: string;
  toCashBankId: string;
  amount: Prisma.Decimal | number | string;
  notes?: string | null;
  userId?: string;
}) {
  const amount = d(input.amount);
  if (amount.lte(0)) throw new AppError(400, "المبلغ يجب أن يكون موجباً");
  if (input.fromCashBankId === input.toCashBankId) throw new AppError(400, "نفس الحساب");

  const [fromB, toB] = await Promise.all([
    prisma.cashBankAccount.findUnique({ where: { id: input.fromCashBankId }, include: { glAccount: true } }),
    prisma.cashBankAccount.findUnique({ where: { id: input.toCashBankId }, include: { glAccount: true } }),
  ]);
  if (!fromB?.glAccountId || !toB?.glAccountId) {
    throw new AppError(400, "يجب ربط حساب GL لكلا الصندوقين");
  }

  return prisma.$transaction(async (tx) => {
    const docNo = await nextTreasuryDocNo(tx, "TRF");
    const tr = await tx.treasuryTransfer.create({
      data: {
        docNo,
        transferDate: input.transferDate,
        fromCashBankId: input.fromCashBankId,
        toCashBankId: input.toCashBankId,
        amount,
        notes: input.notes?.trim() || null,
      },
    });
    const desc = `تحويل نقدي ${docNo}`;
    const je = await fin.createPostedJournal(
      {
        entryDate: input.transferDate,
        description: desc,
        sourceType: "BANK",
        sourceId: tr.id,
        lines: [
          {
            accountId: toB.glAccountId!,
            debit: amount.toString(),
            credit: "0",
            description: desc,
          },
          {
            accountId: fromB.glAccountId!,
            debit: "0",
            credit: amount.toString(),
            description: desc,
          },
        ],
        userId: input.userId,
      },
      tx,
    );
    await tx.treasuryTransfer.update({ where: { id: tr.id }, data: { glJournalEntryId: je.id } });
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "TREASURY_TRANSFER",
        entityType: "TreasuryTransfer",
        entityId: tr.id,
        details: { journalEntryId: je.id },
      },
    });
    return { transfer: tr, journalEntry: je };
  });
}
