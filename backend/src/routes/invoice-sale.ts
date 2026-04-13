import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import * as svc from "../services/saleVoucherService.js";
import * as wf from "../services/workflowService.js";
import * as notify from "../services/notificationService.js";
import { routeParam } from "../utils/params.js";
import { requirePermission } from "../middleware/requirePermission.js";

export const invoiceSaleRouter = Router();

const nullableNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().finite().nullable());

const optionalNullableNumber = nullableNumber.optional();

const listQuery = paginationQuerySchema.extend({
  containerNo: z.string().optional(),
  customer: z.string().optional(),
});

const voucherBody = z.object({
  voucherNo: z.string().min(1),
  voucherDate: z.string().datetime().optional().nullable(),
  exchangeRate: optionalNullableNumber,
  officeCommission: optionalNullableNumber,
  cbmTransportPrice: optionalNullableNumber,
  currency: z.string().default("دولار"),
  containerId: z.string().uuid(),
  customerId: z.string().uuid(),
  storeId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  paid: optionalNullableNumber,
  profit: optionalNullableNumber,
  accountingDebit: optionalNullableNumber,
  accountingCredit: optionalNullableNumber,
});

const lineBody = z.object({
  usdConvertRate: optionalNullableNumber,
  usdSumCol: optionalNullableNumber,
  usdPriceCol: optionalNullableNumber,
  cbmSumCol: optionalNullableNumber,
  weight: optionalNullableNumber,
  cbm1: optionalNullableNumber,
  cbm2: optionalNullableNumber,
  listQty: optionalNullableNumber,
  pricePerThousand: optionalNullableNumber,
  totalPrice: optionalNullableNumber,
  pcsInCarton: optionalNullableNumber,
  linePrice: optionalNullableNumber,
  detail: z.string().optional().nullable(),
  itemNo: z.string().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
});

function toCreate(body: z.infer<typeof voucherBody>): Prisma.SaleVoucherCreateInput {
  return {
    voucherNo: body.voucherNo,
    voucherDate: body.voucherDate ? new Date(body.voucherDate) : undefined,
    exchangeRate: body.exchangeRate,
    officeCommission: body.officeCommission,
    cbmTransportPrice: body.cbmTransportPrice,
    currency: body.currency,
    notes: body.notes ?? undefined,
    paid: body.paid,
    profit: body.profit,
    accountingDebit: body.accountingDebit,
    accountingCredit: body.accountingCredit,
    container: { connect: { id: body.containerId } },
    customer: { connect: { id: body.customerId } },
    store: body.storeId ? { connect: { id: body.storeId } } : undefined,
  };
}

function toUpdate(body: Partial<z.infer<typeof voucherBody>>): Prisma.SaleVoucherUpdateInput {
  const d: Prisma.SaleVoucherUpdateInput = {};
  if (body.voucherNo !== undefined) d.voucherNo = body.voucherNo;
  if (body.voucherDate !== undefined) d.voucherDate = body.voucherDate ? new Date(body.voucherDate) : null;
  if (body.exchangeRate !== undefined) d.exchangeRate = body.exchangeRate;
  if (body.officeCommission !== undefined) d.officeCommission = body.officeCommission;
  if (body.cbmTransportPrice !== undefined) d.cbmTransportPrice = body.cbmTransportPrice;
  if (body.currency !== undefined) d.currency = body.currency;
  if (body.notes !== undefined) d.notes = body.notes;
  if (body.paid !== undefined) d.paid = body.paid;
  if (body.profit !== undefined) d.profit = body.profit;
  if (body.accountingDebit !== undefined) d.accountingDebit = body.accountingDebit;
  if (body.accountingCredit !== undefined) d.accountingCredit = body.accountingCredit;
  if (body.containerId !== undefined) d.container = { connect: { id: body.containerId } };
  if (body.customerId !== undefined) d.customer = { connect: { id: body.customerId } };
  if (body.storeId !== undefined) {
    d.store = body.storeId ? { connect: { id: body.storeId } } : { disconnect: true };
  }
  return d;
}

function toCreateLine(
  body: z.infer<typeof lineBody>,
): Omit<Prisma.SaleVoucherLineUncheckedCreateWithoutVoucherInput, "voucherId" | "seq"> {
  return body;
}

function toUpdateLine(body: Partial<z.infer<typeof lineBody>>): Prisma.SaleVoucherLineUpdateInput {
  return body;
}

invoiceSaleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    res.json(await svc.listSaleVouchers(q));
  }),
);

invoiceSaleRouter.post(
  "/",
  requirePermission("invoice:create"),
  asyncHandler(async (req, res) => {
    const body = voucherBody.parse(req.body);
    const created = await svc.createSaleVoucher(toCreate(body));
    await svc.saleVoucherTotals(created.id);
    const v = await svc.getSaleVoucher(created.id);
    res.status(201).json(v);
  }),
);

invoiceSaleRouter.get(
  "/:id/items",
  asyncHandler(async (req, res) => {
    res.json({ items: await svc.listSaleLines(routeParam(req.params.id)) });
  }),
);

invoiceSaleRouter.post(
  "/:id/items",
  requirePermission("invoice:edit"),
  asyncHandler(async (req, res) => {
    const body = lineBody.parse(req.body);
    const row = await svc.addSaleLine(routeParam(req.params.id), toCreateLine(body));
    await svc.saleVoucherTotals(routeParam(req.params.id));
    res.status(201).json(row);
  }),
);

invoiceSaleRouter.patch(
  "/:id/items/:lineId",
  requirePermission("invoice:edit"),
  asyncHandler(async (req, res) => {
    const body = lineBody.partial().parse(req.body);
    const row = await svc.updateSaleLine(
      routeParam(req.params.id),
      routeParam(req.params.lineId),
      toUpdateLine(body),
    );
    res.json(row);
  }),
);

invoiceSaleRouter.delete(
  "/:id/items/:lineId",
  requirePermission("invoice:edit"),
  asyncHandler(async (req, res) => {
    await svc.deleteSaleLine(routeParam(req.params.id), routeParam(req.params.lineId));
    res.status(204).send();
  }),
);

invoiceSaleRouter.get(
  "/:id/totals",
  asyncHandler(async (req, res) => {
    res.json(await svc.saleVoucherTotals(routeParam(req.params.id)));
  }),
);

invoiceSaleRouter.get(
  "/:id/stock",
  asyncHandler(async (req, res) => {
    const q = z.object({ itemId: z.string().uuid().optional() }).parse(req.query);
    res.json(await svc.getSaleVoucherStock(routeParam(req.params.id), q.itemId));
  }),
);

invoiceSaleRouter.post(
  "/:id/workflow/submit",
  requirePermission("invoice:submit"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const v = await wf.submitSaleVoucherForApproval(id, req.user?.id);
    await notify.notifyApproversSaleInvoiceSubmitted(id, v.voucherNo);
    res.json(v);
  }),
);

invoiceSaleRouter.post(
  "/:id/workflow/approve",
  requirePermission("invoice:approve"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = z.object({ comment: z.string().optional().nullable() }).parse(req.body ?? {});
    const v = await wf.approveSaleVoucher(id, req.user!.id, body.comment);
    res.json(v);
  }),
);

invoiceSaleRouter.post(
  "/:id/workflow/reject",
  requirePermission("invoice:reject"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = z.object({ comment: z.string().optional().nullable() }).parse(req.body ?? {});
    const v = await wf.rejectSaleVoucher(id, req.user!.id, body.comment);
    res.json(v);
  }),
);

invoiceSaleRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await svc.getSaleVoucher(routeParam(req.params.id)));
  }),
);

invoiceSaleRouter.patch(
  "/:id",
  requirePermission("invoice:edit"),
  asyncHandler(async (req, res) => {
    const body = voucherBody.partial().parse(req.body);
    const voucherId = routeParam(req.params.id);
    const v = await svc.updateSaleVoucher(voucherId, toUpdate(body));
    await svc.saleVoucherTotals(voucherId);
    res.json(v);
  }),
);

invoiceSaleRouter.delete(
  "/:id",
  requirePermission("invoice:delete"),
  asyncHandler(async (req, res) => {
    await svc.deleteSaleVoucher(routeParam(req.params.id));
    res.status(204).send();
  }),
);
