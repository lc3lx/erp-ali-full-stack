import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { routeParam } from "../utils/params.js";

export const crmRouter = Router();

crmRouter.get(
  "/leads",
  asyncHandler(async (_req, res) => {
    const items = await prisma.crmLead.findMany({ orderBy: { updatedAt: "desc" } });
    res.json({ items });
  }),
);

crmRouter.post(
  "/leads",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        status: z.string().optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.crmLead.create({
      data: {
        name: body.name.trim(),
        phone: body.phone ?? null,
        company: body.company ?? null,
        status: body.status?.trim() || "NEW",
        notes: body.notes ?? null,
      },
    });
    res.status(201).json(row);
  }),
);

crmRouter.patch(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        phone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        status: z.string().optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.crmLead.update({
      where: { id: routeParam(req.params.id) },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.company !== undefined ? { company: body.company } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    res.json(row);
  }),
);

crmRouter.get(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.crmLead.findUnique({ where: { id: routeParam(req.params.id) } });
    res.json(row);
  }),
);

crmRouter.delete(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    await prisma.crmLead.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  }),
);

crmRouter.get(
  "/quotations",
  asyncHandler(async (_req, res) => {
    const items = await prisma.crmQuotation.findMany({
      orderBy: { quoteDate: "desc" },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.json({ items });
  }),
);

crmRouter.post(
  "/quotations",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        quoteNo: z.string().min(1),
        quoteDate: z.string().datetime(),
        customerId: z.string().uuid().optional().nullable(),
        title: z.string().optional().nullable(),
        total: z.union([z.number(), z.string()]).optional().nullable(),
        status: z.string().optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.crmQuotation.create({
      data: {
        quoteNo: body.quoteNo.trim(),
        quoteDate: new Date(body.quoteDate),
        customerId: body.customerId ?? null,
        title: body.title ?? null,
        total: body.total != null ? new Prisma.Decimal(String(body.total)) : null,
        status: body.status?.trim() ?? "DRAFT",
        notes: body.notes ?? null,
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.status(201).json(row);
  }),
);

crmRouter.patch(
  "/quotations/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        title: z.string().optional().nullable(),
        total: z.union([z.number(), z.string()]).optional().nullable(),
        status: z.string().optional(),
        notes: z.string().optional().nullable(),
        customerId: z.string().uuid().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.crmQuotation.update({
      where: { id: routeParam(req.params.id) },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.total !== undefined
          ? { total: body.total != null ? new Prisma.Decimal(String(body.total)) : null }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.json(row);
  }),
);

crmRouter.get(
  "/quotations/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.crmQuotation.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.json(row);
  }),
);

crmRouter.delete(
  "/quotations/:id",
  asyncHandler(async (req, res) => {
    await prisma.crmQuotation.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  }),
);

crmRouter.post(
  "/quotations/:id/convert-to-sale",
  asyncHandler(async (req, res) => {
    const q = await prisma.crmQuotation.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!q) return res.status(404).json({ error: "Quotation not found" });
    const body = z.object({ containerId: z.string().uuid(), customerId: z.string().uuid().optional() }).parse(req.body ?? {});
    const customerId = body.customerId ?? q.customerId;
    if (!customerId) return res.status(400).json({ error: "customerId is required" });
    const created = await prisma.$transaction(async (tx) => {
      const seqKey = "SALE_VOUCHER_AUTO";
      const existing = await tx.documentSequence.findUnique({ where: { key: seqKey } });
      if (!existing) await tx.documentSequence.create({ data: { key: seqKey, prefix: "SV", nextNum: 1 } });
      const next = await tx.documentSequence.update({
        where: { key: seqKey },
        data: { nextNum: { increment: 1 } },
      });
      const voucherNo = `${next.prefix}-${String(next.nextNum - 1).padStart(6, "0")}`;
      return tx.saleVoucher.create({
        data: {
          voucherNo,
          voucherDate: new Date(),
          containerId: body.containerId,
          customerId,
          currency: "دولار",
          total: q.total ?? new Prisma.Decimal(0),
          remaining: q.total ?? new Prisma.Decimal(0),
          notes: `From quotation ${q.quoteNo}`,
        },
      });
    });
    await prisma.crmQuotation.update({ where: { id: q.id }, data: { status: "CONVERTED" } });
    res.status(201).json(created);
  }),
);
