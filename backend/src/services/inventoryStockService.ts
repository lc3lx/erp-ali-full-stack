import {
  type Prisma,
  type StockMoveType,
  type JournalSourceType,
  type CostingMethod,
  Prisma as PrismaNS,
} from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";

function D(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new PrismaNS.Decimal(0);
  if (v instanceof PrismaNS.Decimal) return v;
  return new PrismaNS.Decimal(String(v));
}

function signedQtyForType(type: StockMoveType, qty: Prisma.Decimal): Prisma.Decimal {
  switch (type) {
    case "PURCHASE_RECEIPT":
    case "TRANSFER_IN":
    case "RETURN_IN":
    case "OPENING":
      return qty;
    case "SALE_ISSUE":
    case "TRANSFER_OUT":
    case "RETURN_OUT":
      return qty.neg();
    case "ADJUSTMENT":
      return qty;
    default:
      return qty;
  }
}

function netQtyDelta(m: { type: StockMoveType; qty: Prisma.Decimal }): Prisma.Decimal {
  if (m.type === "ADJUSTMENT") return D(m.qty);
  return signedQtyForType(m.type, D(m.qty));
}

function minDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lt(b) ? a : b;
}

/**
 * استهلاك FIFO — الأقدم أولاً؛ يحدّث qtyRemaining على InvCostLayer
 */
export async function consumeFIFO(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  itemId: string,
  qtyToIssue: Prisma.Decimal,
): Promise<{ totalCost: Prisma.Decimal }> {
  const need = D(qtyToIssue);
  if (need.lte(0)) return { totalCost: D(0) };

  let remaining = need;
  let totalCost = D(0);

  const layers = await tx.invCostLayer.findMany({
    where: { warehouseId, itemId, qtyRemaining: { gt: 0 } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  for (const layer of layers) {
    if (remaining.lte(0)) break;
    const layerQty = D(layer.qtyRemaining);
    const take = minDec(layerQty, remaining);
    const lineCost = take.mul(D(layer.unitCost));
    totalCost = totalCost.add(lineCost);
    remaining = remaining.sub(take);
    await tx.invCostLayer.update({
      where: { id: layer.id },
      data: { qtyRemaining: layerQty.sub(take) },
    });
  }

  if (remaining.gt(0)) {
    throw new AppError(
      409,
      `FIFO: insufficient layer quantity for item ${itemId} in warehouse ${warehouseId} (short ${remaining})`,
      "FIFO_SHORT",
    );
  }

  return { totalCost };
}

/** إعادة بناء طبقات FIFO من تاريخ الحركات — بعد حذف حركات بيع أو تعديل الماضي */
export async function rebuildFifoLayersFromHistory(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  itemId: string,
) {
  const item = await tx.item.findUnique({ where: { id: itemId } });
  if (!item || item.costingMethod !== "FIFO") return;

  await tx.invCostLayer.deleteMany({ where: { warehouseId, itemId } });

  const moves = await tx.invStockMove.findMany({
    where: { warehouseId, itemId },
    orderBy: [{ moveDate: "asc" }, { id: "asc" }],
  });

  for (const m of moves) {
    const q = netQtyDelta(m);
    if (q.gt(0)) {
      await tx.invCostLayer.create({
        data: {
          warehouseId,
          itemId,
          sourceMoveId: m.id,
          qtyRemaining: q,
          unitCost: D(m.unitCost),
        },
      });
    } else if (q.lt(0)) {
      const { totalCost: _c } = await consumeFIFO(tx, warehouseId, itemId, q.abs());
      void _c;
    }
  }
}

/** إعادة احتساب الرصيد ومتوسط التكلفة من جديلة الحركات */
export async function recomputeStockBalance(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  itemId: string,
) {
  const moves = await tx.invStockMove.findMany({
    where: { warehouseId, itemId },
    orderBy: [{ moveDate: "asc" }, { id: "asc" }],
  });
  let qty = D(0);
  let avg = D(0);
  for (const m of moves) {
    const q = netQtyDelta(m);
    const uc = D(m.unitCost);
    if (q.gt(0)) {
      const nq = qty.add(q);
      if (nq.eq(0)) {
        qty = nq;
        avg = D(0);
      } else {
        const val = qty.mul(avg).add(q.mul(uc));
        avg = val.div(nq);
        qty = nq;
      }
    } else if (q.lt(0)) {
      const out = q.abs();
      qty = qty.sub(out);
      if (qty.lt(0)) {
        throw new AppError(409, `رصيد سالب للصنف في المستودع — تحقق من الحركات`);
      }
    }
  }
  await tx.invStockBalance.upsert({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    create: {
      warehouseId,
      itemId,
      qtyOnHand: qty,
      avgUnitCost: avg,
    },
    update: {
      qtyOnHand: qty,
      avgUnitCost: avg,
    },
  });
}

export async function ensureWarehouseForStore(
  tx: Prisma.TransactionClient,
  storeId: string | null | undefined,
) {
  if (!storeId) return null;
  const existing = await tx.invWarehouse.findFirst({ where: { storeId } });
  if (existing) return existing;
  const store = await tx.store.findUnique({ where: { id: storeId } });
  if (!store) return null;
  return tx.invWarehouse.create({
    data: { name: store.name, storeId },
  });
}

async function landedCostSharePerLine(
  tx: Prisma.TransactionClient,
  containerId: string,
  lines: { id: string; itemId: string | null; weightSum: Prisma.Decimal | null; priceToCustomerSum: Prisma.Decimal | null }[],
  lineId: string,
): Promise<Prisma.Decimal> {
  const costRows = await tx.containerCostLine.findMany({ where: { containerId } });
  const totalLand = costRows.reduce((s, r) => s.add(D(r.amount)), D(0));
  if (totalLand.lte(0)) return D(0);

  const indexed = lines.filter((l) => l.itemId);
  if (indexed.length === 0) return D(0);

  let weights = indexed.reduce((s, l) => s.add(D(l.weightSum).abs()), D(0));
  let basis: "weight" | "value" = "weight";
  if (weights.lte(0)) {
    basis = "value";
    weights = indexed.reduce((s, l) => s.add(D(l.priceToCustomerSum).abs()), D(0));
  }
  if (weights.lte(0)) return D(0);

  const line = indexed.find((l) => l.id === lineId);
  if (!line) return D(0);
  const w = basis === "weight" ? D(line.weightSum).abs() : D(line.priceToCustomerSum).abs();
  return totalLand.mul(w).div(weights);
}

function lineQty(line: {
  piecesSum: Prisma.Decimal | null;
  boxesSum: Prisma.Decimal | null;
}): Prisma.Decimal {
  const p = D(line.piecesSum);
  if (p.gt(0)) return p;
  return D(line.boxesSum);
}

function linePurchaseUnitBaseCost(line: {
  piecesSum: Prisma.Decimal | null;
  boxesSum: Prisma.Decimal | null;
  priceToCustomerSum: Prisma.Decimal | null;
  priceSum: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
}): Prisma.Decimal {
  const qty = lineQty(line);
  if (qty.lte(0)) return D(0);
  const val = D(line.priceToCustomerSum).gt(0)
    ? D(line.priceToCustomerSum)
    : D(line.priceSum).gt(0)
      ? D(line.priceSum)
      : D(line.unitPrice).mul(qty);
  if (val.lte(0)) return D(0);
  return val.div(qty);
}

/** حذف حركات المخزون المرتبطة بفاتورة شراء/بيع ثم إعادة احتساب الأرصدة */
export async function removeInventoryMovesForReference(
  tx: Prisma.TransactionClient,
  referenceId: string,
  kinds: JournalSourceType[],
) {
  const moves = await tx.invStockMove.findMany({
    where: { referenceId, referenceKind: { in: kinds } },
  });
  const pairs = new Map<string, { warehouseId: string; itemId: string }>();
  for (const m of moves) {
    pairs.set(`${m.warehouseId}|${m.itemId}`, { warehouseId: m.warehouseId, itemId: m.itemId });
  }
  const itemsToRebuild: { warehouseId: string; itemId: string; costing: CostingMethod }[] = [];
  for (const m of moves) {
    const it = await tx.item.findUnique({
      where: { id: m.itemId },
      select: { costingMethod: true },
    });
    if (it) {
      itemsToRebuild.push({ warehouseId: m.warehouseId, itemId: m.itemId, costing: it.costingMethod });
    }
  }

  await tx.invStockMove.deleteMany({ where: { referenceId, referenceKind: { in: kinds } } });

  for (const { warehouseId, itemId, costing } of itemsToRebuild) {
    await recomputeStockBalance(tx, warehouseId, itemId);
    if (costing === "FIFO") {
      await rebuildFifoLayersFromHistory(tx, warehouseId, itemId);
    }
  }
}

export async function applyPurchaseVoucherInventory(
  tx: Prisma.TransactionClient,
  voucherId: string,
  moveDate: Date,
) {
  const v = await tx.purchaseInvoiceVoucher.findUnique({
    where: { id: voucherId },
    include: { lines: true, store: true, container: { include: { costLines: true } } },
  });
  if (!v) return;

  await removeInventoryMovesForReference(tx, voucherId, ["PURCHASE_VOUCHER"]);

  const linesWithItems = v.lines.filter((l) => l.itemId && lineQty(l).gt(0));
  if (linesWithItems.length === 0) return;
  if (!v.storeId) {
    throw new AppError(409, "Select a store/warehouse before posting purchase inventory lines");
  }

  const wh = await ensureWarehouseForStore(tx, v.storeId);
  if (!wh) {
    throw new AppError(409, "Warehouse is not configured for the selected store");
  }

  for (const line of linesWithItems) {
    const qty = lineQty(line);
    if (qty.lte(0) || !line.itemId) continue;

    const base = linePurchaseUnitBaseCost(line);
    const landShare = await landedCostSharePerLine(tx, v.containerId, v.lines, line.id);
    const landPerUnit = landShare.div(qty);
    const unitCost = base.add(landPerUnit);

    const moveRow = await tx.invStockMove.create({
      data: {
        moveDate,
        warehouseId: wh.id,
        itemId: line.itemId,
        type: "PURCHASE_RECEIPT",
        qty,
        unitCost,
        totalCost: unitCost.mul(qty),
        referenceKind: "PURCHASE_VOUCHER",
        referenceId: voucherId,
      },
    });
    const catItem = await tx.item.findUnique({ where: { id: line.itemId } });
    if (catItem?.costingMethod === "FIFO") {
      await tx.invCostLayer.create({
        data: {
          warehouseId: wh.id,
          itemId: line.itemId,
          sourceMoveId: moveRow.id,
          qtyRemaining: qty,
          unitCost,
        },
      });
    }
    await recomputeStockBalance(tx, wh.id, line.itemId);
  }
}

export async function applySaleVoucherInventory(
  tx: Prisma.TransactionClient,
  voucherId: string,
  moveDate: Date,
) {
  const v = await tx.saleVoucher.findUnique({
    where: { id: voucherId },
    include: { lines: true },
  });
  if (!v) return;

  await removeInventoryMovesForReference(tx, voucherId, ["SALE_VOUCHER"]);

  const linesWithItems = v.lines.filter((l) => l.itemId && D(l.listQty).gt(0));
  if (linesWithItems.length === 0) return;
  if (!v.storeId) {
    throw new AppError(409, "Select a store/warehouse before posting sale inventory lines");
  }

  const wh = await ensureWarehouseForStore(tx, v.storeId);
  if (!wh) {
    throw new AppError(409, "Warehouse is not configured for the selected store");
  }

  for (const line of linesWithItems) {
    if (!line.itemId) continue;
    const qty = D(line.listQty);
    if (qty.lte(0)) continue;

    const itemMeta = await tx.item.findUnique({ where: { id: line.itemId } });
    let unitCost: Prisma.Decimal;
    let totalCost: Prisma.Decimal;

    if (itemMeta?.costingMethod === "FIFO") {
      const { totalCost: tc } = await consumeFIFO(tx, wh.id, line.itemId, qty);
      totalCost = tc;
      unitCost = qty.gt(0) ? tc.div(qty) : D(0);
    } else {
      const bal = await tx.invStockBalance.findUnique({
        where: { warehouseId_itemId: { warehouseId: wh.id, itemId: line.itemId } },
      });
      unitCost = bal?.avgUnitCost ?? D(0);
      totalCost = unitCost.mul(qty);
    }

    await tx.invStockMove.create({
      data: {
        moveDate,
        warehouseId: wh.id,
        itemId: line.itemId,
        type: "SALE_ISSUE",
        qty,
        unitCost,
        totalCost,
        referenceKind: "SALE_VOUCHER",
        referenceId: voucherId,
      },
    });
    await recomputeStockBalance(tx, wh.id, line.itemId);
  }
}

/** شراء مباشر (وارد مستودع) */
export async function postPurchaseReceipt(input: {
  warehouseId: string;
  itemId: string;
  qty: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  moveDate: Date;
  referenceId?: string | null;
  userId?: string;
}) {
  if (input.qty.lte(0)) throw new AppError(400, "Quantity must be greater than zero");
  if (input.unitCost.lt(0)) throw new AppError(400, "Unit cost cannot be negative");

  return prisma.$transaction(async (tx) => {
    const [warehouse, item] = await Promise.all([
      tx.invWarehouse.findUnique({ where: { id: input.warehouseId } }),
      tx.item.findUnique({ where: { id: input.itemId } }),
    ]);
    if (!warehouse || warehouse.isActive === false) {
      throw new AppError(404, "Warehouse not found or inactive");
    }
    if (!item || item.isActive === false) throw new AppError(404, "Item not found or inactive");

    const move = await tx.invStockMove.create({
      data: {
        moveDate: input.moveDate,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        type: "PURCHASE_RECEIPT",
        qty: input.qty,
        unitCost: input.unitCost,
        totalCost: input.qty.mul(input.unitCost),
        referenceKind: "INVENTORY",
        referenceId: input.referenceId ?? null,
      },
    });

    if (item.costingMethod === "FIFO") {
      await tx.invCostLayer.create({
        data: {
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          sourceMoveId: move.id,
          qtyRemaining: input.qty,
          unitCost: input.unitCost,
        },
      });
    }

    await recomputeStockBalance(tx, input.warehouseId, input.itemId);
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "STOCK_PURCHASE_RECEIPT",
        entityType: "InvStockMove",
        entityId: move.id,
        details: {
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          qty: input.qty.toString(),
          unitCost: input.unitCost.toString(),
          referenceId: input.referenceId ?? null,
        },
      },
    });

    return { ok: true, move };
  });
}

/** بيع مباشر (صادر مستودع) */
export async function postSaleIssue(input: {
  warehouseId: string;
  itemId: string;
  qty: Prisma.Decimal;
  moveDate: Date;
  referenceId?: string | null;
  userId?: string;
}) {
  if (input.qty.lte(0)) throw new AppError(400, "Quantity must be greater than zero");

  return prisma.$transaction(async (tx) => {
    const [warehouse, item] = await Promise.all([
      tx.invWarehouse.findUnique({ where: { id: input.warehouseId } }),
      tx.item.findUnique({ where: { id: input.itemId } }),
    ]);
    if (!warehouse || warehouse.isActive === false) {
      throw new AppError(404, "Warehouse not found or inactive");
    }
    if (!item || item.isActive === false) throw new AppError(404, "Item not found or inactive");

    let unitCost = D(0);
    let totalCost = D(0);
    if (item.costingMethod === "FIFO") {
      const consumed = await consumeFIFO(tx, input.warehouseId, input.itemId, input.qty);
      totalCost = consumed.totalCost;
      unitCost = input.qty.gt(0) ? totalCost.div(input.qty) : D(0);
    } else {
      const bal = await tx.invStockBalance.findUnique({
        where: { warehouseId_itemId: { warehouseId: input.warehouseId, itemId: input.itemId } },
      });
      const onHand = D(bal?.qtyOnHand);
      if (onHand.lt(input.qty)) {
        throw new AppError(409, "Insufficient stock in selected warehouse");
      }
      unitCost = D(bal?.avgUnitCost);
      totalCost = unitCost.mul(input.qty);
    }

    const move = await tx.invStockMove.create({
      data: {
        moveDate: input.moveDate,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        type: "SALE_ISSUE",
        qty: input.qty,
        unitCost,
        totalCost,
        referenceKind: "INVENTORY",
        referenceId: input.referenceId ?? null,
      },
    });

    await recomputeStockBalance(tx, input.warehouseId, input.itemId);
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "STOCK_SALE_ISSUE",
        entityType: "InvStockMove",
        entityId: move.id,
        details: {
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          qty: input.qty.toString(),
          referenceId: input.referenceId ?? null,
        },
      },
    });

    return { ok: true, move };
  });
}

/** تحويل بين مستودعين */
export async function postStockTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  itemId: string;
  qty: Prisma.Decimal;
  moveDate: Date;
  userId?: string;
}) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new AppError(400, "المصدر والوجهة يجب أن يختلفا");
  }
  if (input.qty.lte(0)) throw new AppError(400, "الكمية يجب أن تكون موجبة");

  return prisma.$transaction(async (tx) => {
    const bal = await tx.invStockBalance.findUnique({
      where: {
        warehouseId_itemId: { warehouseId: input.fromWarehouseId, itemId: input.itemId },
      },
    });
    const unitCost = bal?.avgUnitCost ?? D(0);
    if (!bal || D(bal.qtyOnHand).lt(input.qty)) {
      throw new AppError(409, "الرصيد غير كافٍ للتحويل");
    }

    const fromItem = await tx.item.findUnique({ where: { id: input.itemId } });
    let outUnitCost = unitCost;
    let outTotal = unitCost.mul(input.qty);
    if (fromItem?.costingMethod === "FIFO") {
      const { totalCost } = await consumeFIFO(tx, input.fromWarehouseId, input.itemId, input.qty);
      outTotal = totalCost;
      outUnitCost = input.qty.gt(0) ? totalCost.div(input.qty) : D(0);
    }

    await tx.invStockMove.create({
      data: {
        moveDate: input.moveDate,
        warehouseId: input.fromWarehouseId,
        itemId: input.itemId,
        type: "TRANSFER_OUT",
        qty: input.qty,
        unitCost: outUnitCost,
        totalCost: outTotal,
        referenceKind: "INVENTORY",
      },
    });
    const inMove = await tx.invStockMove.create({
      data: {
        moveDate: input.moveDate,
        warehouseId: input.toWarehouseId,
        itemId: input.itemId,
        type: "TRANSFER_IN",
        qty: input.qty,
        unitCost,
        totalCost: unitCost.mul(input.qty),
        referenceKind: "INVENTORY",
      },
    });
    const toItem = await tx.item.findUnique({ where: { id: input.itemId } });
    if (toItem?.costingMethod === "FIFO") {
      await tx.invCostLayer.create({
        data: {
          warehouseId: input.toWarehouseId,
          itemId: input.itemId,
          sourceMoveId: inMove.id,
          qtyRemaining: input.qty,
          unitCost,
        },
      });
    }
    await recomputeStockBalance(tx, input.fromWarehouseId, input.itemId);
    await recomputeStockBalance(tx, input.toWarehouseId, input.itemId);
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "STOCK_TRANSFER",
        entityType: "InvStockMove",
        entityId: input.itemId,
        details: {
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          qty: input.qty.toString(),
        },
      },
    });
    return { ok: true };
  });
}

/** تسوية جرد (كمية موجبة = زيادة، سالبة = نقص) */
export async function postStockAdjustment(input: {
  warehouseId: string;
  itemId: string;
  qtyDelta: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  moveDate: Date;
  userId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    if (input.qtyDelta.eq(0)) throw new AppError(400, "كمية التسوية لا يمكن أن تكون صفراً");
    if (input.qtyDelta.lt(0)) {
      const bal = await tx.invStockBalance.findUnique({
        where: { warehouseId_itemId: { warehouseId: input.warehouseId, itemId: input.itemId } },
      });
      if (!bal || D(bal.qtyOnHand).lt(input.qtyDelta.abs())) {
        throw new AppError(409, "الرصيد لا يسمح بهذه التسوية السالبة");
      }
    }
    const costBase = input.qtyDelta.gt(0) ? input.unitCost : D(0);
    const adjMove = await tx.invStockMove.create({
      data: {
        moveDate: input.moveDate,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        type: "ADJUSTMENT",
        qty: input.qtyDelta,
        unitCost: costBase,
        totalCost: input.qtyDelta.abs().mul(costBase),
        referenceKind: "INVENTORY",
      },
    });
    const adjItem = await tx.item.findUnique({ where: { id: input.itemId } });
    if (adjItem?.costingMethod === "FIFO" && input.qtyDelta.gt(0)) {
      await tx.invCostLayer.create({
        data: {
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          sourceMoveId: adjMove.id,
          qtyRemaining: input.qtyDelta,
          unitCost: costBase,
        },
      });
    }
    if (adjItem?.costingMethod === "FIFO" && input.qtyDelta.lt(0)) {
      await consumeFIFO(tx, input.warehouseId, input.itemId, input.qtyDelta.abs());
    }
    await recomputeStockBalance(tx, input.warehouseId, input.itemId);
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "STOCK_ADJUSTMENT",
        entityType: "InvStockMove",
        entityId: input.itemId,
        details: { warehouseId: input.warehouseId, qtyDelta: input.qtyDelta.toString() },
      },
    });
    return { ok: true };
  });
}
