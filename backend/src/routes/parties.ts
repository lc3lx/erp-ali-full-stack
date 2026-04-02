import { Router } from "express";
import { z } from "zod";
import { PartyType } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { routeParam } from "../utils/params.js";

export const partiesRouter = Router();

const listQuery = paginationQuerySchema.extend({
  type: z.nativeEnum(PartyType).optional(),
  name: z.string().optional(),
});

partiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const { skip, take } = { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
    const where: { type?: PartyType; name?: { contains: string; mode: "insensitive" } } = {};
    if (q.type) where.type = q.type;
    if (q.name) where.name = { contains: q.name, mode: "insensitive" };
    const [items, total] = await Promise.all([
      prisma.party.findMany({ where, skip, take, orderBy: { name: "asc" } }),
      prisma.party.count({ where }),
    ]);
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  }),
);

const partyBody = z.object({
  type: z.nativeEnum(PartyType),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  balanceDisplay: z.string().optional().nullable(),
  saleDiscountDefault: z.union([z.number(), z.string()]).optional().nullable(),
});

partiesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = partyBody.parse(req.body);
    const p = await prisma.party.create({
      data: {
        ...body,
        saleDiscountDefault: body.saleDiscountDefault as never,
      },
    });
    res.status(201).json(p);
  }),
);

partiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const p = await prisma.party.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!p) throw new AppError(404, "Party not found");
    res.json(p);
  }),
);

partiesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = partyBody.partial().parse(req.body);
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.name !== undefined) data.name = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.address !== undefined) data.address = body.address;
    if (body.balanceDisplay !== undefined) data.balanceDisplay = body.balanceDisplay;
    if (body.saleDiscountDefault !== undefined) data.saleDiscountDefault = body.saleDiscountDefault;
    const p = await prisma.party.update({
      where: { id: routeParam(req.params.id) },
      data: data as never,
    });
    res.json(p);
  }),
);

partiesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const [cc, clc, pv, sv, jl] = await Promise.all([
      prisma.container.count({ where: { customerId: id } }),
      prisma.container.count({ where: { clearanceCompanyId: id } }),
      prisma.purchaseInvoiceVoucher.count({ where: { supplierId: id } }),
      prisma.saleVoucher.count({ where: { customerId: id } }),
      prisma.journalLine.count({ where: { partyId: id } }),
    ]);
    if (cc + clc + pv + sv + jl > 0) {
      throw new AppError(
        400,
        `لا يمكن حذف الطرف: مرتبط بحاويات أو فواتير أو قيود (${cc} زبون، ${clc} تخليص، ${pv} شراء، ${sv} بيع، ${jl} سطر محاسبة)`,
      );
    }
    await prisma.party.delete({ where: { id } });
    res.status(204).send();
  }),
);
