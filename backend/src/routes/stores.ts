import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { routeParam } from "../utils/params.js";

export const storesRouter = Router();

storesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.store.findMany({ orderBy: { name: "asc" } });
    res.json({ items });
  }),
);

storesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    const s = await prisma.store.create({ data: body });
    res.status(201).json(s);
  }),
);

storesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const s = await prisma.store.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!s) throw new AppError(404, "Store not found");
    res.json(s);
  }),
);

storesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    try {
      const s = await prisma.store.update({ where: { id: routeParam(req.params.id) }, data: body });
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
    await prisma.$transaction([
      prisma.purchaseInvoiceVoucher.updateMany({ where: { storeId: id }, data: { storeId: null } }),
      prisma.saleVoucher.updateMany({ where: { storeId: id }, data: { storeId: null } }),
      prisma.journalLine.updateMany({ where: { storeId: id }, data: { storeId: null } }),
    ]);
    await prisma.invWarehouse.updateMany({ where: { storeId: id }, data: { storeId: null } });
    try {
      await prisma.store.delete({ where: { id } });
    } catch {
      throw new AppError(409, "تعذر حذف المخزن — قد يكون مرتبطاً بسجلات أخرى");
    }
    res.status(204).send();
  }),
);
