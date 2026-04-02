import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { routeParam } from "../utils/params.js";

export const invWarehousesRouter = Router();

invWarehousesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.invWarehouse.findMany({
      orderBy: { name: "asc" },
      include: { store: { select: { id: true, name: true } } },
    });
    res.json({ items });
  }),
);

invWarehousesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        code: z.string().optional().nullable(),
        storeId: z.string().uuid().optional().nullable(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    if (body.storeId) {
      const taken = await prisma.invWarehouse.findFirst({ where: { storeId: body.storeId } });
      if (taken) throw new AppError(409, "هذا المخزن مرتبط بمستودع آخر بالفعل");
    }
    const row = await prisma.invWarehouse.create({
      data: {
        name: body.name.trim(),
        code: body.code?.trim() || null,
        storeId: body.storeId ?? null,
        isActive: body.isActive ?? true,
      },
      include: { store: { select: { id: true, name: true } } },
    });
    res.status(201).json(row);
  }),
);

invWarehousesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.invWarehouse.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { store: { select: { id: true, name: true } } },
    });
    if (!row) throw new AppError(404, "المستودع غير موجود");
    res.json(row);
  }),
);

invWarehousesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        code: z.string().optional().nullable(),
        storeId: z.string().uuid().optional().nullable(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const id = routeParam(req.params.id);
    if (body.storeId) {
      const taken = await prisma.invWarehouse.findFirst({
        where: { storeId: body.storeId, NOT: { id } },
      });
      if (taken) throw new AppError(409, "المخزن مرتبط بمستودع آخر");
    }
    try {
      const row = await prisma.invWarehouse.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.code !== undefined ? { code: body.code?.trim() || null } : {}),
          ...(body.storeId !== undefined ? { storeId: body.storeId } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        include: { store: { select: { id: true, name: true } } },
      });
      res.json(row);
    } catch {
      throw new AppError(404, "المستودع غير موجود");
    }
  }),
);

invWarehousesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const moves = await prisma.invStockMove.count({ where: { warehouseId: id } });
    if (moves > 0) {
      throw new AppError(409, "لا يمكن حذف مستودع له حركات مخزون");
    }
    try {
      await prisma.invWarehouse.delete({ where: { id } });
    } catch {
      throw new AppError(409, "تعذر حذف المستودع");
    }
    res.status(204).send();
  }),
);
