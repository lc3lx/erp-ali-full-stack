import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AccountingDirection } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import * as svc from "../services/accountingService.js";
import { routeParam } from "../utils/params.js";

export const accountingMovesRouter = Router();

const listQuery = paginationQuerySchema;

const moveBody = z.object({
  moveDate: z.string().datetime(),
  reportFrom: z.string().datetime().optional().nullable(),
  reportTo: z.string().datetime().optional().nullable(),
  exchangeRate: z.union([z.number(), z.string()]).optional().nullable(),
  topCurrency: z.string().default("دولار"),
  searchQuery: z.string().optional().nullable(),
});

const lineBody = z.object({
  direction: z.nativeEnum(AccountingDirection),
  panelCurrency: z.string().default("دولار"),
  dinar: z.union([z.number(), z.string()]).optional().nullable(),
  jineh: z.union([z.number(), z.string()]).optional().nullable(),
  usd: z.union([z.number(), z.string()]).optional().nullable(),
  rmb: z.union([z.number(), z.string()]).optional().nullable(),
  lineNo: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  lineDate: z.string().datetime().optional().nullable(),
});

function toCreate(body: z.infer<typeof moveBody>): Prisma.AccountingMoveCreateInput {
  return {
    moveDate: new Date(body.moveDate),
    reportFrom: body.reportFrom ? new Date(body.reportFrom) : undefined,
    reportTo: body.reportTo ? new Date(body.reportTo) : undefined,
    exchangeRate: body.exchangeRate as never,
    topCurrency: body.topCurrency,
    searchQuery: body.searchQuery ?? undefined,
  };
}

function toUpdate(body: Partial<z.infer<typeof moveBody>>): Prisma.AccountingMoveUpdateInput {
  const d: Prisma.AccountingMoveUpdateInput = {};
  if (body.moveDate !== undefined) d.moveDate = new Date(body.moveDate);
  if (body.reportFrom !== undefined) d.reportFrom = body.reportFrom ? new Date(body.reportFrom) : null;
  if (body.reportTo !== undefined) d.reportTo = body.reportTo ? new Date(body.reportTo) : null;
  if (body.exchangeRate !== undefined) d.exchangeRate = body.exchangeRate as never;
  if (body.topCurrency !== undefined) d.topCurrency = body.topCurrency;
  if (body.searchQuery !== undefined) d.searchQuery = body.searchQuery;
  return d;
}

accountingMovesRouter.get(
  "/customer-discounts",
  asyncHandler(async (req, res) => {
    const q = z.object({ q: z.string().default("") }).parse(req.query);
    res.json({ items: await svc.searchCustomersWithDiscount(q.q) });
  }),
);

accountingMovesRouter.get(
  "/customer-totals/:query",
  asyncHandler(async (req, res) => {
    res.json(await svc.customerTotals(routeParam(req.params.query)));
  }),
);

accountingMovesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    res.json(await svc.listAccountingMoves(q));
  }),
);

accountingMovesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = moveBody.parse(req.body);
    const m = await svc.createAccountingMove(toCreate(body));
    res.status(201).json(m);
  }),
);

accountingMovesRouter.get(
  "/:id/lines",
  asyncHandler(async (req, res) => {
    res.json({ items: await svc.listAccountingLines(routeParam(req.params.id)) });
  }),
);

accountingMovesRouter.post(
  "/:id/lines",
  asyncHandler(async (req, res) => {
    const body = lineBody.parse(req.body);
    const row = await svc.addAccountingLine(routeParam(req.params.id), {
      ...body,
      lineDate: body.lineDate ? new Date(body.lineDate) : undefined,
    } as never);
    res.status(201).json(row);
  }),
);

accountingMovesRouter.patch(
  "/:id/lines/:lineId",
  asyncHandler(async (req, res) => {
    const body = lineBody.partial().parse(req.body);
    const patch: Prisma.AccountingLineUpdateInput = {};
    if (body.direction !== undefined) patch.direction = body.direction;
    if (body.panelCurrency !== undefined) patch.panelCurrency = body.panelCurrency;
    if (body.dinar !== undefined) patch.dinar = body.dinar as never;
    if (body.jineh !== undefined) patch.jineh = body.jineh as never;
    if (body.usd !== undefined) patch.usd = body.usd as never;
    if (body.rmb !== undefined) patch.rmb = body.rmb as never;
    if (body.lineNo !== undefined) patch.lineNo = body.lineNo;
    if (body.details !== undefined) patch.details = body.details;
    if (body.lineDate !== undefined) patch.lineDate = body.lineDate ? new Date(body.lineDate) : null;
    const row = await svc.updateAccountingLine(routeParam(req.params.id), routeParam(req.params.lineId), patch);
    res.json(row);
  }),
);

accountingMovesRouter.delete(
  "/:id/lines/:lineId",
  asyncHandler(async (req, res) => {
    await svc.deleteAccountingLine(routeParam(req.params.id), routeParam(req.params.lineId));
    res.status(204).send();
  }),
);

accountingMovesRouter.get(
  "/:id/totals",
  asyncHandler(async (req, res) => {
    res.json(await svc.accountingTotals(routeParam(req.params.id)));
  }),
);

accountingMovesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await svc.getAccountingMove(routeParam(req.params.id)));
  }),
);

accountingMovesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = moveBody.partial().parse(req.body);
    res.json(await svc.updateAccountingMove(routeParam(req.params.id), toUpdate(body)));
  }),
);

accountingMovesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await svc.deleteAccountingMove(routeParam(req.params.id));
    res.status(204).send();
  }),
);
