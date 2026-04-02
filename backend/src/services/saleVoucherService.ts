import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";
import * as wf from "./workflowService.js";

function dec(n: Prisma.Decimal | null | undefined): number {
  if (n == null) return 0;
  return Number(n);
}

export async function listSaleVouchers(query: PaginationQuery & { containerNo?: string; customer?: string }) {
  const { skip, take } = skipTake(query);
  const where: Prisma.SaleVoucherWhereInput = {};
  if (query.containerNo) {
    where.container = { containerNo: { contains: query.containerNo, mode: "insensitive" } };
  }
  if (query.customer) {
    where.customer = { name: { contains: query.customer, mode: "insensitive" } };
  }
  const [items, total] = await Promise.all([
    prisma.saleVoucher.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: "desc" },
      include: { container: true, customer: true, store: true, _count: { select: { lines: true } } },
    }),
    prisma.saleVoucher.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getSaleVoucher(id: string) {
  const v = await prisma.saleVoucher.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { seq: "asc" }, include: { item: true } },
      container: true,
      customer: true,
      store: true,
    },
  });
  if (!v) throw new AppError(404, "Sale voucher not found");
  return v;
}

export async function createSaleVoucher(data: Prisma.SaleVoucherCreateInput) {
  const created = await prisma.saleVoucher.create({ data });
  await saleVoucherTotals(created.id);
  return getSaleVoucher(created.id);
}

export async function updateSaleVoucher(id: string, data: Prisma.SaleVoucherUpdateInput) {
  const existing = await prisma.saleVoucher.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Sale voucher not found");
  wf.assertCanEditSaleVoucher({
    id: existing.id,
    documentStatus: existing.documentStatus,
    glJournalEntryId: existing.glJournalEntryId,
  });
  try {
    await prisma.saleVoucher.update({ where: { id }, data });
    await saleVoucherTotals(id);
    return getSaleVoucher(id);
  } catch {
    throw new AppError(404, "Sale voucher not found");
  }
}

export async function deleteSaleVoucher(id: string) {
  const existing = await prisma.saleVoucher.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Sale voucher not found");
  wf.assertCanDeleteSaleVoucher({
    id: existing.id,
    documentStatus: existing.documentStatus,
    glJournalEntryId: existing.glJournalEntryId,
  });
  await prisma.saleVoucher.delete({ where: { id } });
}

export async function addSaleLine(
  voucherId: string,
  body: Omit<Prisma.SaleVoucherLineUncheckedCreateWithoutVoucherInput, "voucherId" | "seq">,
) {
  const v = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Sale voucher not found");
  wf.assertCanEditSaleVoucher({
    id: v.id,
    documentStatus: v.documentStatus,
    glJournalEntryId: v.glJournalEntryId,
  });
  const max = await prisma.saleVoucherLine.aggregate({
    where: { voucherId },
    _max: { seq: true },
  });
  const seq = (max._max.seq ?? 0) + 1;
  return prisma.saleVoucherLine.create({
    data: { ...body, seq, voucherId },
  });
}

export async function listSaleLines(voucherId: string) {
  await getSaleVoucher(voucherId);
  return prisma.saleVoucherLine.findMany({ where: { voucherId }, orderBy: { seq: "asc" } });
}

export async function updateSaleLine(voucherId: string, lineId: string, data: Prisma.SaleVoucherLineUpdateInput) {
  const head = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!head) throw new AppError(404, "Sale voucher not found");
  wf.assertCanEditSaleVoucher({
    id: head.id,
    documentStatus: head.documentStatus,
    glJournalEntryId: head.glJournalEntryId,
  });
  const line = await prisma.saleVoucherLine.findFirst({ where: { id: lineId, voucherId } });
  if (!line) throw new AppError(404, "Line not found");
  const row = await prisma.saleVoucherLine.update({ where: { id: lineId }, data });
  await saleVoucherTotals(voucherId);
  return row;
}

export async function deleteSaleLine(voucherId: string, lineId: string) {
  const head = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!head) throw new AppError(404, "Sale voucher not found");
  wf.assertCanEditSaleVoucher({
    id: head.id,
    documentStatus: head.documentStatus,
    glJournalEntryId: head.glJournalEntryId,
  });
  const line = await prisma.saleVoucherLine.findFirst({ where: { id: lineId, voucherId } });
  if (!line) throw new AppError(404, "Line not found");
  await prisma.saleVoucherLine.delete({ where: { id: lineId } });
  await saleVoucherTotals(voucherId);
}

export async function saleVoucherTotals(voucherId: string) {
  const lines = await listSaleLines(voucherId);
  let totalPrice = 0;
  let cbmSum = 0;
  let listQty = 0;
  for (const l of lines) {
    totalPrice += dec(l.totalPrice);
    cbmSum += dec(l.cbmSumCol);
    listQty += dec(l.listQty);
  }
  const v = await getSaleVoucher(voucherId);
  const paid = dec(v.paid);
  const remaining = totalPrice - paid;
  const profit = dec(v.profit);
  await prisma.saleVoucher.update({
    where: { id: voucherId },
    data: { total: totalPrice, remaining },
  });
  return {
    total: totalPrice,
    paid,
    remaining,
    profit,
    aggregates: { totalPrice, cbmSum, listQty },
  };
}
