import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { routeParam } from "../utils/params.js";
import * as inv from "../services/inventoryStockService.js";

export const inventoryRouter = Router();

inventoryRouter.get(
  "/purchased-products",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        storeId: z.string().uuid().optional(),
        warehouseId: z.string().uuid().optional(),
        q: z.string().optional(),
        onlyWithStock: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);

    const items = await inv.listPurchasedProducts({
      storeId: q.storeId,
      warehouseId: q.warehouseId,
      q: q.q,
      onlyWithStock: q.onlyWithStock !== "false",
    });
    res.json({ items });
  }),
);

inventoryRouter.get(
  "/stock-balances",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        warehouseId: z.string().uuid().optional(),
        itemId: z.string().uuid().optional(),
      })
      .parse(req.query);
    const whereBal: Prisma.InvStockBalanceWhereInput = {};
    if (q.warehouseId) whereBal.warehouseId = q.warehouseId;
    if (q.itemId) whereBal.itemId = q.itemId;
    const rows = await prisma.invStockBalance.findMany({
      where: whereBal,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        item: { select: { id: true, name: true, itemNo: true, barcode: true, imageUrl: true } },
      },
      orderBy: [{ warehouseId: "asc" }, { itemId: "asc" }],
    });
    res.json({ items: rows });
  }),
);

inventoryRouter.get(
  "/stock-totals",
  asyncHandler(async (req, res) => {
    const q = z.object({ itemId: z.string().uuid().optional() }).parse(req.query);
    const whereBal: Prisma.InvStockBalanceWhereInput = {};
    if (q.itemId) whereBal.itemId = q.itemId;
    const rows = await prisma.invStockBalance.findMany({
      where: whereBal,
      include: {
        item: { select: { id: true, name: true, itemNo: true, barcode: true, imageUrl: true } },
      },
      orderBy: [{ itemId: "asc" }, { warehouseId: "asc" }],
    });

    const totals = new Map<string, { item: (typeof rows)[number]["item"]; qtyOnHand: Prisma.Decimal }>();
    for (const row of rows) {
      const prev = totals.get(row.itemId);
      if (!prev) {
        totals.set(row.itemId, { item: row.item, qtyOnHand: new Prisma.Decimal(row.qtyOnHand) });
      } else {
        prev.qtyOnHand = prev.qtyOnHand.add(row.qtyOnHand);
      }
    }

    const items = Array.from(totals.entries())
      .map(([itemId, val]) => ({ itemId, item: val.item, qtyOnHand: val.qtyOnHand }))
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
    res.json({ items });
  }),
);

inventoryRouter.get(
  "/stock-moves",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        warehouseId: z.string().uuid().optional(),
        itemId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(500).optional().default(100),
      })
      .parse(req.query);
    const whereMoves: Prisma.InvStockMoveWhereInput = {};
    if (q.warehouseId) whereMoves.warehouseId = q.warehouseId;
    if (q.itemId) whereMoves.itemId = q.itemId;
    const items = await prisma.invStockMove.findMany({
      where: whereMoves,
      take: q.limit,
      orderBy: { moveDate: "desc" },
      include: {
        warehouse: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
      },
    });
    res.json({ items });
  }),
);

inventoryRouter.post(
  "/transfer",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fromWarehouseId: z.string().uuid(),
        toWarehouseId: z.string().uuid(),
        itemId: z.string().uuid(),
        qty: z.union([z.number(), z.string()]),
        moveDate: z.string().datetime().optional(),
      })
      .parse(req.body);
    const r = await inv.postStockTransfer({
      fromWarehouseId: body.fromWarehouseId,
      toWarehouseId: body.toWarehouseId,
      itemId: body.itemId,
      qty: new Prisma.Decimal(String(body.qty)),
      moveDate: body.moveDate ? new Date(body.moveDate) : new Date(),
      userId: (req as Express.Request & { user?: { id: string } }).user?.id,
    });
    res.status(201).json(r);
  }),
);

inventoryRouter.post(
  "/adjustment",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        warehouseId: z.string().uuid(),
        itemId: z.string().uuid(),
        qtyDelta: z.union([z.number(), z.string()]),
        unitCost: z.union([z.number(), z.string()]).optional().default(0),
        moveDate: z.string().datetime().optional(),
      })
      .parse(req.body);
    const r = await inv.postStockAdjustment({
      warehouseId: body.warehouseId,
      itemId: body.itemId,
      qtyDelta: new Prisma.Decimal(String(body.qtyDelta)),
      unitCost: new Prisma.Decimal(String(body.unitCost ?? 0)),
      moveDate: body.moveDate ? new Date(body.moveDate) : new Date(),
      userId: (req as Express.Request & { user?: { id: string } }).user?.id,
    });
    res.status(201).json(r);
  }),
);

inventoryRouter.post(
  "/purchase-receipt",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        warehouseId: z.string().uuid(),
        itemId: z.string().uuid(),
        qty: z.union([z.number(), z.string()]),
        unitCost: z.union([z.number(), z.string()]).optional().default(0),
        moveDate: z.string().datetime().optional(),
        referenceId: z.string().optional().nullable(),
      })
      .parse(req.body);
    const r = await inv.postPurchaseReceipt({
      warehouseId: body.warehouseId,
      itemId: body.itemId,
      qty: new Prisma.Decimal(String(body.qty)),
      unitCost: new Prisma.Decimal(String(body.unitCost)),
      moveDate: body.moveDate ? new Date(body.moveDate) : new Date(),
      referenceId: body.referenceId ?? null,
      userId: (req as Express.Request & { user?: { id: string } }).user?.id,
    });
    res.status(201).json(r);
  }),
);

inventoryRouter.post(
  "/sale-issue",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        warehouseId: z.string().uuid(),
        itemId: z.string().uuid(),
        qty: z.union([z.number(), z.string()]),
        moveDate: z.string().datetime().optional(),
        referenceId: z.string().optional().nullable(),
      })
      .parse(req.body);
    const r = await inv.postSaleIssue({
      warehouseId: body.warehouseId,
      itemId: body.itemId,
      qty: new Prisma.Decimal(String(body.qty)),
      moveDate: body.moveDate ? new Date(body.moveDate) : new Date(),
      referenceId: body.referenceId ?? null,
      userId: (req as Express.Request & { user?: { id: string } }).user?.id,
    });
    res.status(201).json(r);
  }),
);

inventoryRouter.get(
  "/items/:itemId/card",
  asyncHandler(async (req, res) => {
    const itemId = routeParam(req.params.itemId);
    const q = z.object({ warehouseId: z.string().uuid().optional() }).parse(req.query);
    const whereCard: Prisma.InvStockMoveWhereInput = { itemId };
    if (q.warehouseId) whereCard.warehouseId = q.warehouseId;
    const moves = await prisma.invStockMove.findMany({
      where: whereCard,
      orderBy: [{ moveDate: "asc" }, { id: "asc" }],
      include: { warehouse: { select: { name: true } } },
    });
    res.json({ itemId, moves });
  }),
);
