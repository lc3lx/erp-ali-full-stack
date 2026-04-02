import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { routeParam } from "../utils/params.js";
import { paginationQuerySchema } from "../utils/pagination.js";

export const itemsRouter = Router();

const listQuery = paginationQuerySchema.extend({
  q: z.string().optional(),
  category: z.string().optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
});

const itemBody = z.object({
  itemNo: z.string().optional().nullable(),
  name: z.string().min(1),
  barcode: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  defaultUom: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

itemsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const { skip, take } = { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
    const where: Prisma.ItemWhereInput = {};
    if (q.activeOnly !== "false") where.isActive = true;
    if (q.category?.trim()) where.category = q.category.trim();
    if (q.q?.trim()) {
      where.OR = [
        { name: { contains: q.q.trim(), mode: "insensitive" } },
        { itemNo: { contains: q.q.trim(), mode: "insensitive" } },
        { barcode: { contains: q.q.trim(), mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, skip, take, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.item.count({ where }),
    ]);
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  }),
);

itemsRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const q = z.object({ q: z.string().optional() }).parse(req.query);
    const where: Prisma.ItemWhereInput = { isActive: true };
    if (q.q?.trim()) {
      where.OR = [
        { name: { contains: q.q.trim(), mode: "insensitive" } },
        { itemNo: { contains: q.q.trim(), mode: "insensitive" } },
        { barcode: { contains: q.q.trim(), mode: "insensitive" } },
      ];
    }
    const items = await prisma.item.findMany({
      where,
      take: 50,
      orderBy: { name: "asc" },
      select: { id: true, itemNo: true, name: true, barcode: true, defaultUom: true, category: true },
    });
    res.json({ items });
  }),
);

itemsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = itemBody.parse(req.body);
    if (body.barcode?.trim()) {
      const dup = await prisma.item.findFirst({ where: { barcode: body.barcode.trim() } });
      if (dup) throw new AppError(409, "الباركود مستخدم لصنف آخر");
    }
    const row = await prisma.item.create({
      data: {
        itemNo: body.itemNo?.trim() || null,
        name: body.name.trim(),
        barcode: body.barcode?.trim() || null,
        category: body.category?.trim() || null,
        defaultUom: body.defaultUom?.trim() || null,
        isActive: body.isActive ?? true,
      },
    });
    res.status(201).json(row);
  }),
);

itemsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.item.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!row) throw new AppError(404, "الصنف غير موجود");
    res.json(row);
  }),
);

itemsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = itemBody.partial().parse(req.body);
    const id = routeParam(req.params.id);
    if (body.barcode !== undefined && body.barcode?.trim()) {
      const dup = await prisma.item.findFirst({
        where: { barcode: body.barcode.trim(), NOT: { id } },
      });
      if (dup) throw new AppError(409, "الباركود مستخدم لصنف آخر");
    }
    try {
      const row = await prisma.item.update({
        where: { id },
        data: {
          ...(body.itemNo !== undefined ? { itemNo: body.itemNo?.trim() || null } : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.barcode !== undefined ? { barcode: body.barcode?.trim() || null } : {}),
          ...(body.category !== undefined ? { category: body.category?.trim() || null } : {}),
          ...(body.defaultUom !== undefined ? { defaultUom: body.defaultUom?.trim() || null } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      res.json(row);
    } catch {
      throw new AppError(404, "الصنف غير موجود");
    }
  }),
);

itemsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const [pm, sm, nonzeroBal] = await Promise.all([
      prisma.purchaseVoucherLine.count({ where: { itemId: id } }),
      prisma.saleVoucherLine.count({ where: { itemId: id } }),
      prisma.invStockBalance.findFirst({
        where: {
          itemId: id,
          OR: [
            { qtyOnHand: { gt: new Prisma.Decimal("0.000001") } },
            { qtyOnHand: { lt: new Prisma.Decimal("-0.000001") } },
          ],
        },
      }),
    ]);
    if (pm || sm) {
      throw new AppError(409, "لا يمكن حذف صنف مرتبط بفواتير — عطّله بدلاً من ذلك");
    }
    if (nonzeroBal) {
      throw new AppError(409, "لا يمكن حذف صنف له رصيد مخزون");
    }
    try {
      await prisma.item.delete({ where: { id } });
    } catch {
      throw new AppError(409, "تعذر حذف الصنف");
    }
    res.status(204).send();
  }),
);
