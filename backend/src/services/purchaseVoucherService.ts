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

function purchaseLineQty(line: { piecesSum: Prisma.Decimal | null; boxesSum: Prisma.Decimal | null }) {
  const pieces = dec(line.piecesSum);
  if (pieces > 0) return pieces;
  return dec(line.boxesSum);
}

function hasInventoryPurchaseLines(
  lines: { itemId: string | null; piecesSum: Prisma.Decimal | null; boxesSum: Prisma.Decimal | null }[],
) {
  return lines.some((line) => line.itemId && purchaseLineQty(line) > 0);
}

async function syncPurchaseInventory(tx: Prisma.TransactionClient, voucherId: string) {
  const voucher = await tx.purchaseInvoiceVoucher.findUnique({
    where: { id: voucherId },
    select: {
      id: true,
      storeId: true,
      voucherDate: true,
      lines: {
        select: { itemId: true, piecesSum: true, boxesSum: true },
      },
    },
  });
  if (!voucher) throw new AppError(404, "Voucher not found");
  if (hasInventoryPurchaseLines(voucher.lines) && !voucher.storeId) {
    throw new AppError(409, "Select a store/warehouse before adding inventory purchase quantities");
  }
  await inv.applyPurchaseVoucherInventory(tx, voucherId, voucher.voucherDate ?? new Date());
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
    await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoiceVoucher.update({ where: { id }, data });
      await syncPurchaseInventory(tx, id);
    });
    await purchaseVoucherTotals(id);
    return getPurchaseVoucher(id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError(404, "Voucher not found");
    }
    throw error;
  }
}

export async function getPurchaseVoucherStock(voucherId: string, itemId?: string | null) {
  const voucher = await prisma.purchaseInvoiceVoucher.findUnique({
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
  if (!voucher) throw new AppError(404, "Voucher not found");
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

export async function deletePurchaseVoucher(id: string) {
  const existing = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Voucher not found");
  wf.assertCanDeletePurchaseVoucher({
    id: existing.id,
    documentStatus: existing.documentStatus,
    glJournalEntryId: existing.glJournalEntryId,
  });
  await prisma.$transaction(async (tx) => {
    await inv.removeInventoryMovesForReference(tx, id, ["PURCHASE_VOUCHER"]);
    await tx.purchaseInvoiceVoucher.delete({ where: { id } });
  });
}

export async function addPurchaseLine(
  voucherId: string,
  body: Omit<Prisma.PurchaseVoucherLineUncheckedCreateWithoutVoucherInput, "voucherId" | "seq">,
) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
    if (!v) throw new AppError(404, "Voucher not found");
    wf.assertCanEditPurchaseVoucher({
      id: v.id,
      documentStatus: v.documentStatus,
      glJournalEntryId: v.glJournalEntryId,
    });
    const max = await tx.purchaseVoucherLine.aggregate({
      where: { voucherId },
      _max: { seq: true },
    });
    const seq = (max._max.seq ?? 0) + 1;
    const row = await tx.purchaseVoucherLine.create({
      data: { ...body, seq, voucherId },
    });
    await syncPurchaseInventory(tx, voucherId);
    return row;
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
  const row = await prisma.$transaction(async (tx) => {
    const head = await tx.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
    if (!head) throw new AppError(404, "Voucher not found");
    wf.assertCanEditPurchaseVoucher({
      id: head.id,
      documentStatus: head.documentStatus,
      glJournalEntryId: head.glJournalEntryId,
    });
    const line = await tx.purchaseVoucherLine.findFirst({ where: { id: lineId, voucherId } });
    if (!line) throw new AppError(404, "Line not found");
    const updated = await tx.purchaseVoucherLine.update({ where: { id: lineId }, data });
    await syncPurchaseInventory(tx, voucherId);
    return updated;
  });
  await purchaseVoucherTotals(voucherId);
  return row;
}

export async function deletePurchaseLine(voucherId: string, lineId: string) {
  await prisma.$transaction(async (tx) => {
    const head = await tx.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
    if (!head) throw new AppError(404, "Voucher not found");
    wf.assertCanEditPurchaseVoucher({
      id: head.id,
      documentStatus: head.documentStatus,
      glJournalEntryId: head.glJournalEntryId,
    });
    const line = await tx.purchaseVoucherLine.findFirst({ where: { id: lineId, voucherId } });
    if (!line) throw new AppError(404, "Line not found");
    await tx.purchaseVoucherLine.delete({ where: { id: lineId } });
    await syncPurchaseInventory(tx, voucherId);
  });
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
