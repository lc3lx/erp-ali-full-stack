import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";
import * as wf from "./workflowService.js";

function dec(n: Prisma.Decimal | null | undefined): number {
  if (n == null) return 0;
  return Number(n);
}

export async function listPurchaseVouchers(
  query: PaginationQuery & { date?: string; voucherNo?: string; containerNo?: string; supplier?: string },
) {
  const { skip, take } = skipTake(query);
  const where: Prisma.PurchaseInvoiceVoucherWhereInput = {};
  if (query.voucherNo) where.voucherNo = query.voucherNo;
  if (query.date) {
    const d = new Date(query.date);
    if (!Number.isNaN(d.getTime())) {
      where.voucherDate = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
  }
  if (query.containerNo) {
    where.container = { containerNo: { contains: query.containerNo, mode: "insensitive" } };
  }
  if (query.supplier) {
    where.supplier = { name: { contains: query.supplier, mode: "insensitive" } };
  }

  const [items, total] = await Promise.all([
    prisma.purchaseInvoiceVoucher.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: "desc" },
      include: { container: true, supplier: true, store: true, _count: { select: { lines: true } } },
    }),
    prisma.purchaseInvoiceVoucher.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getPurchaseVoucher(id: string) {
  const v = await prisma.purchaseInvoiceVoucher.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { seq: "asc" }, include: { item: true } },
      container: true,
      supplier: true,
      store: true,
    },
  });
  if (!v) throw new AppError(404, "Voucher not found");
  return v;
}

export async function createPurchaseVoucher(data: Prisma.PurchaseInvoiceVoucherCreateInput) {
  const created = await prisma.purchaseInvoiceVoucher.create({ data });
  await purchaseVoucherTotals(created.id);
  return getPurchaseVoucher(created.id);
}

export async function updatePurchaseVoucher(id: string, data: Prisma.PurchaseInvoiceVoucherUpdateInput) {
  const existing = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Voucher not found");
  wf.assertCanEditPurchaseVoucher({
    id: existing.id,
    documentStatus: existing.documentStatus,
    glJournalEntryId: existing.glJournalEntryId,
  });
  try {
    await prisma.purchaseInvoiceVoucher.update({ where: { id }, data });
    await purchaseVoucherTotals(id);
    return getPurchaseVoucher(id);
  } catch {
    throw new AppError(404, "Voucher not found");
  }
}

export async function deletePurchaseVoucher(id: string) {
  const existing = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Voucher not found");
  wf.assertCanDeletePurchaseVoucher({
    id: existing.id,
    documentStatus: existing.documentStatus,
    glJournalEntryId: existing.glJournalEntryId,
  });
  await prisma.purchaseInvoiceVoucher.delete({ where: { id } });
}

export async function addPurchaseLine(
  voucherId: string,
  body: Omit<Prisma.PurchaseVoucherLineUncheckedCreateWithoutVoucherInput, "voucherId" | "seq">,
) {
  const v = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Voucher not found");
  wf.assertCanEditPurchaseVoucher({
    id: v.id,
    documentStatus: v.documentStatus,
    glJournalEntryId: v.glJournalEntryId,
  });
  const max = await prisma.purchaseVoucherLine.aggregate({
    where: { voucherId },
    _max: { seq: true },
  });
  const seq = (max._max.seq ?? 0) + 1;
  return prisma.purchaseVoucherLine.create({
    data: { ...body, seq, voucherId },
  });
}

export async function listPurchaseLines(voucherId: string) {
  await getPurchaseVoucher(voucherId);
  return prisma.purchaseVoucherLine.findMany({ where: { voucherId }, orderBy: { seq: "asc" } });
}

export async function updatePurchaseLine(
  voucherId: string,
  lineId: string,
  data: Prisma.PurchaseVoucherLineUpdateInput,
) {
  const head = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!head) throw new AppError(404, "Voucher not found");
  wf.assertCanEditPurchaseVoucher({
    id: head.id,
    documentStatus: head.documentStatus,
    glJournalEntryId: head.glJournalEntryId,
  });
  const line = await prisma.purchaseVoucherLine.findFirst({ where: { id: lineId, voucherId } });
  if (!line) throw new AppError(404, "Line not found");
  const row = await prisma.purchaseVoucherLine.update({ where: { id: lineId }, data });
  await purchaseVoucherTotals(voucherId);
  return row;
}

export async function deletePurchaseLine(voucherId: string, lineId: string) {
  const head = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!head) throw new AppError(404, "Voucher not found");
  wf.assertCanEditPurchaseVoucher({
    id: head.id,
    documentStatus: head.documentStatus,
    glJournalEntryId: head.glJournalEntryId,
  });
  const line = await prisma.purchaseVoucherLine.findFirst({ where: { id: lineId, voucherId } });
  if (!line) throw new AppError(404, "Line not found");
  await prisma.purchaseVoucherLine.delete({ where: { id: lineId } });
  await purchaseVoucherTotals(voucherId);
}

export async function purchaseVoucherTotals(voucherId: string) {
  const lines = await listPurchaseLines(voucherId);
  let priceToCustomerSum = 0;
  let weightSum = 0;
  let boxesSum = 0;
  let piecesSum = 0;
  for (const l of lines) {
    priceToCustomerSum += dec(l.priceToCustomerSum);
    weightSum += dec(l.weightSum);
    boxesSum += dec(l.boxesSum);
    piecesSum += dec(l.piecesSum);
  }
  const summation = priceToCustomerSum;
  const v = await getPurchaseVoucher(voucherId);
  const paid = dec(v.paid);
  const balance = summation - paid;
  await prisma.purchaseInvoiceVoucher.update({
    where: { id: voucherId },
    data: { summation, balance },
  });
  return { summation, paid, balance, aggregates: { priceToCustomerSum, weightSum, boxesSum, piecesSum } };
}
