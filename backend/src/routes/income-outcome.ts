import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IncomeOutcomeKind } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import * as svc from "../services/incomeOutcomeService.js";
import { routeParam } from "../utils/params.js";

export const incomeOutcomeRouter = Router();

const nullableNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}, z.number().finite().nullable());

const listQuery = paginationQuerySchema.extend({
  date: z.string().optional(),
  currency: z.string().optional(),
  kind: z.nativeEnum(IncomeOutcomeKind).optional(),
});

const entryBody = z.object({
  kind: z.nativeEnum(IncomeOutcomeKind),
  entryDate: z.string().datetime(),
  currency: z.string().default("دولار"),
  documentNo: z.string().optional().nullable(),
  fees: nullableNumber.optional(),
  amountUsd: nullableNumber.optional(),
  amountRmb: nullableNumber.optional(),
  amountJineh: nullableNumber.optional(),
  detailsText: z.string().optional().nullable(),
});

function toCreate(body: z.infer<typeof entryBody>): Prisma.IncomeOutcomeEntryCreateInput {
  return {
    kind: body.kind,
    entryDate: new Date(body.entryDate),
    currency: body.currency,
    documentNo: body.documentNo ?? undefined,
    fees: body.fees ?? undefined,
    amountUsd: body.amountUsd ?? undefined,
    amountRmb: body.amountRmb ?? undefined,
    amountJineh: body.amountJineh ?? undefined,
    detailsText: body.detailsText ?? undefined,
  };
}

function toUpdate(body: Partial<z.infer<typeof entryBody>>): Prisma.IncomeOutcomeEntryUpdateInput {
  const d: Prisma.IncomeOutcomeEntryUpdateInput = {};
  if (body.kind !== undefined) d.kind = body.kind;
  if (body.entryDate !== undefined) d.entryDate = new Date(body.entryDate);
  if (body.currency !== undefined) d.currency = body.currency;
  if (body.documentNo !== undefined) d.documentNo = body.documentNo;
  if (body.fees !== undefined) d.fees = body.fees;
  if (body.amountUsd !== undefined) d.amountUsd = body.amountUsd;
  if (body.amountRmb !== undefined) d.amountRmb = body.amountRmb;
  if (body.amountJineh !== undefined) d.amountJineh = body.amountJineh;
  if (body.detailsText !== undefined) d.detailsText = body.detailsText;
  return d;
}

incomeOutcomeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    res.json(await svc.listIncomeOutcome(q));
  }),
);

incomeOutcomeRouter.get(
  "/totals",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        date: z.string().optional(),
        currency: z.string().optional(),
        kind: z.nativeEnum(IncomeOutcomeKind).optional(),
      })
      .parse(req.query);
    res.json(await svc.incomeOutcomeTotals(q));
  }),
);

incomeOutcomeRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = entryBody.parse(req.body);
    const row = await svc.createIncomeOutcomeEntry(toCreate(body));
    res.status(201).json(row);
  }),
);

incomeOutcomeRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await svc.getIncomeOutcomeEntry(routeParam(req.params.id)));
  }),
);

incomeOutcomeRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = entryBody.partial().parse(req.body);
    res.json(await svc.updateIncomeOutcomeEntry(routeParam(req.params.id), toUpdate(body)));
  }),
);

incomeOutcomeRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await svc.deleteIncomeOutcomeEntry(routeParam(req.params.id));
    res.status(204).send();
  }),
);
