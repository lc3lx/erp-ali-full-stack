import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";
import * as wf from "./workflowService.js";
import * as inv from "./inventoryStockService.js";

function dec(n: Prisma.Decimal | null | undefined): number {
  if (n == null) return 0;
  return Number(n);
}

function hasInventorySaleLines(lines: { itemId: string | null; listQty: Prisma.Decimal | null }[]) {
  return lines.some((line) => line.itemId && dec(line.listQty) > 0);
}

async function syncSaleInventory(tx: Prisma.TransactionClient, voucherId: string) {
  const voucher = await tx.saleVoucher.findUnique({
    where: { id: voucherId },
    select: {
      id: true,
      storeId: true,
      voucherDate: true,
      lines: {
        select: { itemId: true, listQty: true },
      },
    },
  });
  if (!voucher) throw new AppError(404, "Sale voucher not found");
  if (hasInventorySaleLines(voucher.lines) && !voucher.storeId) {
    throw new AppError(409, "Select a store/warehouse before adding inventory sale quantities");
  }
  await inv.applySaleVoucherInventory(tx, voucherId, voucher.voucherDate ?? new Date());
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
    await prisma.$transaction(async (tx) => {
      await tx.saleVoucher.update({ where: { id }, data });
      await syncSaleInventory(tx, id);
    });
    await saleVoucherTotals(id);
    return getSaleVoucher(id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError(404, "Sale voucher not found");
    }
    throw error;
  }
}

export async function getSaleVoucherStock(voucherId: string, itemId?: string | null) {
  const voucher = await prisma.saleVoucher.findUnique({
    where: { id: voucherId },
    include: {
      store: {
        include: {
          invWarehouse: {
            select: { id: true, name: true, code: true, isActive: true, storeId: true },
          },
        },
      },
      lines: {
        where: itemId ? { itemId } : undefined,
        select: { itemId: true },
      },
    },
  });
  if (!voucher) throw new AppError(404, "Sale voucher not found");
  const warehouse = voucher.store?.invWarehouse ?? null;
  if (!warehouse) return { warehouse: null, items: [] as Prisma.InvStockBalanceGetPayload<{ include: { item: true } }>[] };

  const fromLines = voucher.lines.map((line) => line.itemId).filter((x): x is string => Boolean(x));
  const targetItemIds = itemId ? [itemId] : Array.from(new Set(fromLines));
  if (targetItemIds.length === 0) return { warehouse, items: [] as Prisma.InvStockBalanceGetPayload<{ include: { item: true } }>[] };

  const rows = await prisma.invStockBalance.findMany({
    where: {
      warehouseId: warehouse.id,
      itemId: { in: targetItemIds },
    },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          itemNo: true,
          barcode: true,
          defaultUom: true,
          category: true,
        },
      },
    },
  });

  const byItem = new Map(rows.map((row) => [row.itemId, row]));
  const missingIds = targetItemIds.filter((id) => !byItem.has(id));
  const missingItems = missingIds.length
    ? await prisma.item.findMany({
        where: { id: { in: missingIds } },
        select: {
          id: true,
          name: true,
          itemNo: true,
          barcode: true,
          defaultUom: true,
          category: true,
        },
      })
    : [];

  const synthetic = missingItems.map((item) => ({
    warehouseId: warehouse.id,
    itemId: item.id,
    qtyOnHand: new Prisma.Decimal(0),
    avgUnitCost: new Prisma.Decimal(0),
    updatedAt: new Date(0),
    item,
  }));

  const items = [...rows, ...synthetic].sort((a, b) => a.item.name.localeCompare(b.item.name));
  return { warehouse, items };
}

export async function deleteSaleVoucher(id: string) {
  const existing = await prisma.saleVoucher.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Sale voucher not found");
  wf.assertCanDeleteSaleVoucher({
    id: existing.id,
    documentStatus: existing.documentStatus,
    glJournalEntryId: existing.glJournalEntryId,
  });
  await prisma.$transaction(async (tx) => {
    await inv.removeInventoryMovesForReference(tx, id, ["SALE_VOUCHER"]);
    await tx.saleVoucher.delete({ where: { id } });
  });
}

export async function addSaleLine(
  voucherId: string,
  body: Omit<Prisma.SaleVoucherLineUncheckedCreateWithoutVoucherInput, "voucherId" | "seq">,
) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.saleVoucher.findUnique({ where: { id: voucherId } });
    if (!v) throw new AppError(404, "Sale voucher not found");
    wf.assertCanEditSaleVoucher({
      id: v.id,
      documentStatus: v.documentStatus,
      glJournalEntryId: v.glJournalEntryId,
    });
    const max = await tx.saleVoucherLine.aggregate({
      where: { voucherId },
      _max: { seq: true },
    });
    const seq = (max._max.seq ?? 0) + 1;
    const row = await tx.saleVoucherLine.create({
      data: { ...body, seq, voucherId },
    });
    await syncSaleInventory(tx, voucherId);
    return row;
  });
}

export async function listSaleLines(voucherId: string) {
  await getSaleVoucher(voucherId);
  return prisma.saleVoucherLine.findMany({ where: { voucherId }, orderBy: { seq: "asc" } });
}

export async function updateSaleLine(voucherId: string, lineId: string, data: Prisma.SaleVoucherLineUpdateInput) {
  const row = await prisma.$transaction(async (tx) => {
    const head = await tx.saleVoucher.findUnique({ where: { id: voucherId } });
    if (!head) throw new AppError(404, "Sale voucher not found");
    wf.assertCanEditSaleVoucher({
      id: head.id,
      documentStatus: head.documentStatus,
      glJournalEntryId: head.glJournalEntryId,
    });
    const line = await tx.saleVoucherLine.findFirst({ where: { id: lineId, voucherId } });
    if (!line) throw new AppError(404, "Line not found");
    const updated = await tx.saleVoucherLine.update({ where: { id: lineId }, data });
    await syncSaleInventory(tx, voucherId);
    return updated;
  });
  await saleVoucherTotals(voucherId);
  return row;
}

export async function deleteSaleLine(voucherId: string, lineId: string) {
  await prisma.$transaction(async (tx) => {
    const head = await tx.saleVoucher.findUnique({ where: { id: voucherId } });
    if (!head) throw new AppError(404, "Sale voucher not found");
    wf.assertCanEditSaleVoucher({
      id: head.id,
      documentStatus: head.documentStatus,
      glJournalEntryId: head.glJournalEntryId,
    });
    const line = await tx.saleVoucherLine.findFirst({ where: { id: lineId, voucherId } });
    if (!line) throw new AppError(404, "Line not found");
    await tx.saleVoucherLine.delete({ where: { id: lineId } });
    await syncSaleInventory(tx, voucherId);
  });
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
