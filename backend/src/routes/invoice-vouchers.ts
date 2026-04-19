import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import * as svc from "../services/purchaseVoucherService.js";
import * as wf from "../services/workflowService.js";
import * as notify from "../services/notificationService.js";
import { routeParam } from "../utils/params.js";
import { requirePermission } from "../middleware/requirePermission.js";

export const invoiceVouchersRouter = Router();

const nullableNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().finite().nullable());

const optionalNullableNumber = nullableNumber.optional();

const listQuery = paginationQuerySchema.extend({
  date: z.string().optional(),
  voucherNo: z.string().optional(),
  containerNo: z.string().optional(),
  customer: z.string().optional(),
  supplier: z.string().optional(),
});

const voucherBody = z.object({
  voucherNo: z.string().min(1),
  voucherDate: z.string().datetime().optional().nullable(),
  exchangeRate: optionalNullableNumber,
  officeCommission: optionalNullableNumber,
  cbmTransportPrice: optionalNullableNumber,
  currency: z.string().default("دولار"),
  containerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid(),
  storeId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  phoneBalanceText: z.string().optional().nullable(),
  paid: optionalNullableNumber,
});

const lineBody = z.object({
  priceToCustomerSum: optionalNullableNumber,
  weightSum: optionalNullableNumber,
  weight: optionalNullableNumber,
  cbmSum: optionalNullableNumber,
  cbm: optionalNullableNumber,
  boxesSum: optionalNullableNumber,
  piecesSum: optionalNullableNumber,
  priceSum: optionalNullableNumber,
  cartonPcs: optionalNullableNumber,
  unitPrice: optionalNullableNumber,
  itemName: z.string().optional().nullable(),
  itemNo: z.string().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
});

function toCreate(body: z.infer<typeof voucherBody>): Prisma.PurchaseInvoiceVoucherCreateInput {
  return {
    voucherNo: body.voucherNo,
    voucherDate: body.voucherDate ? new Date(body.voucherDate) : undefined,
    exchangeRate: body.exchangeRate,
    officeCommission: body.officeCommission,
    cbmTransportPrice: body.cbmTransportPrice,
    currency: body.currency,
    notes: body.notes ?? undefined,
    phoneBalanceText: body.phoneBalanceText ?? undefined,
    paid: body.paid,
    container: body.containerId ? { connect: { id: body.containerId } } : undefined,
    supplier: { connect: { id: body.supplierId } },
    store: body.storeId ? { connect: { id: body.storeId } } : undefined,
  };
}

function toCreateLine(
  body: z.infer<typeof lineBody>,
): Omit<Prisma.PurchaseVoucherLineUncheckedCreateWithoutVoucherInput, "voucherId" | "seq"> {
  return body;
}

function toUpdateLine(
  body: Partial<z.infer<typeof lineBody>>,
): Prisma.PurchaseVoucherLineUpdateInput {
  return body;
}

function toUpdate(body: Partial<z.infer<typeof voucherBody>>): Prisma.PurchaseInvoiceVoucherUpdateInput {
  const d: Prisma.PurchaseInvoiceVoucherUpdateInput = {};
  if (body.voucherNo !== undefined) d.voucherNo = body.voucherNo;
  if (body.voucherDate !== undefined) d.voucherDate = body.voucherDate ? new Date(body.voucherDate) : null;
  if (body.exchangeRate !== undefined) d.exchangeRate = body.exchangeRate;
  if (body.officeCommission !== undefined) d.officeCommission = body.officeCommission;
  if (body.cbmTransportPrice !== undefined) d.cbmTransportPrice = body.cbmTransportPrice;
  if (body.currency !== undefined) d.currency = body.currency;
  if (body.notes !== undefined) d.notes = body.notes;
  if (body.phoneBalanceText !== undefined) d.phoneBalanceText = body.phoneBalanceText;
  if (body.paid !== undefined) d.paid = body.paid;
  if (body.containerId !== undefined) {
    d.container = body.containerId ? { connect: { id: body.containerId } } : { disconnect: true };
  }
  if (body.supplierId !== undefined) d.supplier = { connect: { id: body.supplierId } };
  if (body.storeId !== undefined) {
    d.store = body.storeId ? { connect: { id: body.storeId } } : { disconnect: true };
  }
  return d;
}

invoiceVouchersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const data = await svc.listPurchaseVouchers(q);
    res.json(data);
  }),
);

invoiceVouchersRouter.post(
  "/",
  requirePermission("purchase_invoice:create"),
  asyncHandler(async (req, res) => {
    const body = voucherBody.parse(req.body);
    const created = await svc.createPurchaseVoucher(toCreate(body));
    await svc.purchaseVoucherTotals(created.id);
    const v = await svc.getPurchaseVoucher(created.id);
    res.status(201).json(v);
  }),
);

invoiceVouchersRouter.get(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const items = await svc.listPurchaseLines(routeParam(req.params.id));
    res.json({ items });
  }),
);

invoiceVouchersRouter.post(
  "/:id/items",
  requirePermission("purchase_invoice:edit"),
  asyncHandler(async (req, res) => {
    const body = lineBody.parse(req.body);
    const row = await svc.addPurchaseLine(routeParam(req.params.id), toCreateLine(body));
    await svc.purchaseVoucherTotals(routeParam(req.params.id));
    res.status(201).json(row);
  }),
);

invoiceVouchersRouter.patch(
  "/:id/items/:lineId",
  requirePermission("purchase_invoice:edit"),
  asyncHandler(async (req, res) => {
    const body = lineBody.partial().parse(req.body);
    const row = await svc.updatePurchaseLine(
      routeParam(req.params.id),
      routeParam(req.params.lineId),
      toUpdateLine(body),
    );
    res.json(row);
  }),
);

invoiceVouchersRouter.delete(
  "/:id/items/:lineId",
  requirePermission("purchase_invoice:edit"),
  asyncHandler(async (req, res) => {
    await svc.deletePurchaseLine(routeParam(req.params.id), routeParam(req.params.lineId));
    res.status(204).send();
  }),
);

invoiceVouchersRouter.get(
  "/:id/totals",
  asyncHandler(async (req, res) => {
    const totals = await svc.purchaseVoucherTotals(routeParam(req.params.id));
    res.json(totals);
  }),
);

invoiceVouchersRouter.get(
  "/:id/stock",
  asyncHandler(async (req, res) => {
    const q = z.object({ itemId: z.string().uuid().optional() }).parse(req.query);
    res.json(await svc.getPurchaseVoucherStock(routeParam(req.params.id), q.itemId));
  }),
);

invoiceVouchersRouter.post(
  "/:id/workflow/submit",
  requirePermission("purchase_invoice:submit"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const v = await wf.submitPurchaseVoucherForApproval(id, req.user?.id);
    await notify.notifyApproversPurchaseInvoiceSubmitted(id, v.voucherNo);
    res.json(v);
  }),
);

invoiceVouchersRouter.post(
  "/:id/workflow/approve",
  requirePermission("purchase_invoice:approve"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = z.object({ comment: z.string().optional().nullable() }).parse(req.body ?? {});
    const v = await wf.approvePurchaseVoucher(id, req.user!.id, body.comment);
    res.json(v);
  }),
);

invoiceVouchersRouter.post(
  "/:id/workflow/reject",
  requirePermission("purchase_invoice:reject"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = z.object({ comment: z.string().optional().nullable() }).parse(req.body ?? {});
    const v = await wf.rejectPurchaseVoucher(id, req.user!.id, body.comment);
    res.json(v);
  }),
);

invoiceVouchersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const v = await svc.getPurchaseVoucher(routeParam(req.params.id));
    res.json(v);
  }),
);

invoiceVouchersRouter.patch(
  "/:id",
  requirePermission("purchase_invoice:edit"),
  asyncHandler(async (req, res) => {
    const body = voucherBody.partial().parse(req.body);
    const voucherId = routeParam(req.params.id);
    const v = await svc.updatePurchaseVoucher(voucherId, toUpdate(body));
    await svc.purchaseVoucherTotals(voucherId);
    res.json(v);
  }),
);

invoiceVouchersRouter.delete(
  "/:id",
  requirePermission("purchase_invoice:delete"),
  asyncHandler(async (req, res) => {
    await svc.deletePurchaseVoucher(routeParam(req.params.id));
    res.status(204).send();
  }),
);
