import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { routeParam } from "../utils/params.js";

export const storesRouter = Router();

const storeWithWarehouse = {
  invWarehouse: {
    select: { id: true, code: true, name: true, isActive: true, storeId: true },
  },
} as const;

storesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.store.findMany({
      orderBy: { name: "asc" },
      include: storeWithWarehouse,
    });
    res.json({ items });
  }),
);

storesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        warehouseCode: z.string().optional().nullable(),
        warehouseActive: z.boolean().optional(),
      })
      .parse(req.body);
    const name = body.name.trim();
    const row = await prisma.$transaction(async (tx) => {
      const s = await tx.store.create({ data: { name } });
      await tx.invWarehouse.create({
        data: {
          name,
          storeId: s.id,
          code: body.warehouseCode?.trim() || null,
          isActive: body.warehouseActive ?? true,
        },
      });
      return tx.store.findUniqueOrThrow({
        where: { id: s.id },
        include: storeWithWarehouse,
      });
    });
    res.status(201).json(row);
  }),
);

storesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const s = await prisma.store.findUnique({
      where: { id: routeParam(req.params.id) },
      include: storeWithWarehouse,
    });
    if (!s) throw new AppError(404, "Store not found");
    res.json(s);
  }),
);

storesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        warehouseCode: z.string().optional().nullable(),
        warehouseActive: z.boolean().optional(),
      })
      .parse(req.body);
    const id = routeParam(req.params.id);
    const name = body.name.trim();
    try {
      await prisma.store.update({ where: { id }, data: { name } });
      const wh = await prisma.invWarehouse.findFirst({ where: { storeId: id } });
      if (!wh) {
        await prisma.invWarehouse.create({
          data: {
            name,
            storeId: id,
            code: body.warehouseCode?.trim() || null,
            isActive: body.warehouseActive ?? true,
          },
        });
      } else {
        await prisma.invWarehouse.update({
          where: { id: wh.id },
          data: {
            name,
            ...(body.warehouseCode !== undefined ? { code: body.warehouseCode?.trim() || null } : {}),
            ...(body.warehouseActive !== undefined ? { isActive: body.warehouseActive } : {}),
          },
        });
      }
      const s = await prisma.store.findUniqueOrThrow({
        where: { id },
        include: storeWithWarehouse,
      });
      res.json(s);
    } catch {
      throw new AppError(404, "Store not found");
    }
  }),
);

storesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const wh = await prisma.invWarehouse.findFirst({ where: { storeId: id } });
    if (wh) {
      const moves = await prisma.invStockMove.count({ where: { warehouseId: wh.id } });
      if (moves > 0) {
        throw new AppError(
          409,
          "لا يمكن حذف المخزن لوجود حركات مخزون مرتبطة به — استخدم أرصدة المخزون للمراجعة",
        );
      }
      await prisma.invWarehouse.delete({ where: { id: wh.id } });
    }
    await prisma.$transaction([
      prisma.purchaseInvoiceVoucher.updateMany({ where: { storeId: id }, data: { storeId: null } }),
      prisma.saleVoucher.updateMany({ where: { storeId: id }, data: { storeId: null } }),
      prisma.journalLine.updateMany({ where: { storeId: id }, data: { storeId: null } }),
    ]);
    try {
      await prisma.store.delete({ where: { id } });
    } catch {
      throw new AppError(409, "تعذر حذف المخزن — قد يكون مرتبطاً بسجلات أخرى");
    }
    res.status(204).send();
  }),
);
