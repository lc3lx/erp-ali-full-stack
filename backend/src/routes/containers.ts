import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ContainerStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import { prisma } from "../db/client.js";
import * as svc from "../services/containerService.js";
import { routeParam } from "../utils/params.js";

export const containersRouter = Router();

const listQuery = paginationQuerySchema.extend({
  containerNo: z.string().optional(),
  status: z.nativeEnum(ContainerStatus).optional(),
});

const containerBody = z.object({
  containerNo: z.string().min(1),
  documentDate: z.string().datetime().optional().nullable(),
  arriveDate: z.string().datetime().optional().nullable(),
  isLoaded: z.boolean().optional(),
  centralPoint: z.string().optional().nullable(),
  sourceCountry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  contents: z.string().optional().nullable(),
  telexNo: z.string().optional().nullable(),
  officeCommissionPercent: z.union([z.number(), z.string()]).optional().nullable(),
  cbmTransportPrice: z.union([z.number(), z.string()]).optional().nullable(),
  chinaExchangeRate: z.union([z.number(), z.string()]).optional().nullable(),
  status: z.nativeEnum(ContainerStatus).optional(),
  customerId: z.string().uuid().optional().nullable(),
  clearanceCompanyId: z.string().uuid().optional().nullable(),
  shipperText: z.string().optional().nullable(),
  policyNo: z.string().optional().nullable(),
  shipDate: z.string().datetime().optional().nullable(),
  weightTotal: z.union([z.number(), z.string()]).optional().nullable(),
  cartonsTotal: z.number().int().optional().nullable(),
  profit: z.union([z.number(), z.string()]).optional().nullable(),
  received: z.boolean().optional(),
  release: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPhone: z.string().optional().nullable(),
  axis: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  releaseExportFlag: z.boolean().optional(),
});

const lineBody = z.object({
  realPrice: z.union([z.number(), z.string()]).optional().nullable(),
  pieceTransport: z.union([z.number(), z.string()]).optional().nullable(),
  weightSum: z.union([z.number(), z.string()]).optional().nullable(),
  weight: z.union([z.number(), z.string()]).optional().nullable(),
  cbmSum: z.union([z.number(), z.string()]).optional().nullable(),
  cbm: z.union([z.number(), z.string()]).optional().nullable(),
  priceToCustomerSum: z.union([z.number(), z.string()]).optional().nullable(),
  priceToCustomer: z.union([z.number(), z.string()]).optional().nullable(),
  boxes: z.number().int().optional().nullable(),
  pieces: z.union([z.number(), z.string()]).optional().nullable(),
  byPriceSum: z.union([z.number(), z.string()]).optional().nullable(),
  cartonPcs: z.union([z.number(), z.string()]).optional().nullable(),
  byPrice: z.union([z.number(), z.string()]).optional().nullable(),
  itemName: z.string().optional().nullable(),
  itemNo: z.string().optional().nullable(),
  hasItem: z.boolean().optional(),
  itemId: z.string().uuid().optional().nullable(),
});

const costBody = z.object({
  label: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

function toCreateInput(body: z.infer<typeof containerBody>): Prisma.ContainerCreateInput {
  return {
    containerNo: body.containerNo,
    documentDate: body.documentDate ? new Date(body.documentDate) : undefined,
    arriveDate: body.arriveDate ? new Date(body.arriveDate) : undefined,
    isLoaded: body.isLoaded,
    centralPoint: body.centralPoint ?? undefined,
    sourceCountry: body.sourceCountry ?? undefined,
    notes: body.notes ?? undefined,
    contents: body.contents ?? undefined,
    telexNo: body.telexNo ?? undefined,
    officeCommissionPercent: body.officeCommissionPercent as never,
    cbmTransportPrice: body.cbmTransportPrice as never,
    chinaExchangeRate: body.chinaExchangeRate as never,
    status: body.status,
    shipperText: body.shipperText ?? undefined,
    policyNo: body.policyNo ?? undefined,
    shipDate: body.shipDate ? new Date(body.shipDate) : undefined,
    weightTotal: body.weightTotal as never,
    cartonsTotal: body.cartonsTotal ?? undefined,
    profit: body.profit as never,
    received: body.received,
    release: body.release ?? undefined,
    receiverName: body.receiverName ?? undefined,
    receiverPhone: body.receiverPhone ?? undefined,
    axis: body.axis ?? undefined,
    country: body.country ?? undefined,
    releaseExportFlag: body.releaseExportFlag,
    customer: body.customerId ? { connect: { id: body.customerId } } : undefined,
    clearanceCompany: body.clearanceCompanyId ? { connect: { id: body.clearanceCompanyId } } : undefined,
  };
}

function toUpdateInput(body: Partial<z.infer<typeof containerBody>>): Prisma.ContainerUpdateInput {
  const data: Prisma.ContainerUpdateInput = {};
  if (body.containerNo !== undefined) data.containerNo = body.containerNo;
  if (body.documentDate !== undefined) data.documentDate = body.documentDate ? new Date(body.documentDate) : null;
  if (body.arriveDate !== undefined) data.arriveDate = body.arriveDate ? new Date(body.arriveDate) : null;
  if (body.isLoaded !== undefined) data.isLoaded = body.isLoaded;
  if (body.centralPoint !== undefined) data.centralPoint = body.centralPoint;
  if (body.sourceCountry !== undefined) data.sourceCountry = body.sourceCountry;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.contents !== undefined) data.contents = body.contents;
  if (body.telexNo !== undefined) data.telexNo = body.telexNo;
  if (body.officeCommissionPercent !== undefined) data.officeCommissionPercent = body.officeCommissionPercent as never;
  if (body.cbmTransportPrice !== undefined) data.cbmTransportPrice = body.cbmTransportPrice as never;
  if (body.chinaExchangeRate !== undefined) data.chinaExchangeRate = body.chinaExchangeRate as never;
  if (body.status !== undefined) data.status = body.status;
  if (body.shipperText !== undefined) data.shipperText = body.shipperText;
  if (body.policyNo !== undefined) data.policyNo = body.policyNo;
  if (body.shipDate !== undefined) data.shipDate = body.shipDate ? new Date(body.shipDate) : null;
  if (body.weightTotal !== undefined) data.weightTotal = body.weightTotal as never;
  if (body.cartonsTotal !== undefined) data.cartonsTotal = body.cartonsTotal;
  if (body.profit !== undefined) data.profit = body.profit as never;
  if (body.received !== undefined) data.received = body.received;
  if (body.release !== undefined) data.release = body.release;
  if (body.receiverName !== undefined) data.receiverName = body.receiverName;
  if (body.receiverPhone !== undefined) data.receiverPhone = body.receiverPhone;
  if (body.axis !== undefined) data.axis = body.axis;
  if (body.country !== undefined) data.country = body.country;
  if (body.releaseExportFlag !== undefined) data.releaseExportFlag = body.releaseExportFlag;
  if (body.customerId !== undefined) {
    data.customer = body.customerId ? { connect: { id: body.customerId } } : { disconnect: true };
  }
  if (body.clearanceCompanyId !== undefined) {
    data.clearanceCompany = body.clearanceCompanyId
      ? { connect: { id: body.clearanceCompanyId } }
      : { disconnect: true };
  }
  return data;
}

containersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const data = await svc.listContainers(q);
    res.json(data);
  }),
);

containersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = containerBody.parse(req.body);
    const c = await svc.createContainer(toCreateInput(body));
    res.status(201).json(c);
  }),
);

containersRouter.get(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const items = await svc.listContainerLines(routeParam(req.params.id));
    res.json({ items });
  }),
);

containersRouter.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const body = lineBody.parse(req.body);
    const row = await svc.addContainerLine(routeParam(req.params.id), body as never);
    res.status(201).json(row);
  }),
);

containersRouter.get(
  "/:id/totals",
  asyncHandler(async (req, res) => {
    const totals = await svc.containerLineTotals(routeParam(req.params.id));
    res.json(totals);
  }),
);

containersRouter.post(
  "/:id/cost-lines",
  asyncHandler(async (req, res) => {
    const body = costBody.parse(req.body);
    const row = await svc.addCostLine(routeParam(req.params.id), body);
    res.status(201).json(row);
  }),
);

containersRouter.patch(
  "/:id/items/:lineId",
  asyncHandler(async (req, res) => {
    const body = lineBody.partial().parse(req.body);
    const row = await svc.updateContainerLine(routeParam(req.params.id), routeParam(req.params.lineId), body as never);
    res.json(row);
  }),
);

containersRouter.delete(
  "/:id/items/:lineId",
  asyncHandler(async (req, res) => {
    await svc.deleteContainerLine(routeParam(req.params.id), routeParam(req.params.lineId));
    res.status(204).send();
  }),
);

containersRouter.patch(
  "/:id/cost-lines/:costId",
  asyncHandler(async (req, res) => {
    const body = costBody.partial().parse(req.body);
    const row = await svc.updateCostLine(routeParam(req.params.id), routeParam(req.params.costId), body);
    res.json(row);
  }),
);

containersRouter.delete(
  "/:id/cost-lines/:costId",
  asyncHandler(async (req, res) => {
    await svc.deleteCostLine(routeParam(req.params.id), routeParam(req.params.costId));
    res.status(204).send();
  }),
);

containersRouter.get(
  "/:id/attachments",
  asyncHandler(async (req, res) => {
    const items = await prisma.containerAttachment.findMany({
      where: { containerId: routeParam(req.params.id) },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  }),
);

containersRouter.post(
  "/:id/attachments",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fileName: z.string().min(1),
        fileUrl: z.string().min(1),
        kind: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.containerAttachment.create({
      data: {
        containerId: routeParam(req.params.id),
        fileName: body.fileName.trim(),
        fileUrl: body.fileUrl.trim(),
        kind: body.kind?.trim() || null,
      },
    });
    res.status(201).json(row);
  }),
);

containersRouter.delete(
  "/:id/attachments/:attId",
  asyncHandler(async (req, res) => {
    await prisma.containerAttachment.deleteMany({
      where: { id: routeParam(req.params.attId), containerId: routeParam(req.params.id) },
    });
    res.status(204).send();
  }),
);

containersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const c = await svc.getContainer(routeParam(req.params.id));
    res.json(c);
  }),
);

containersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = containerBody.partial().parse(req.body);
    const c = await svc.updateContainer(routeParam(req.params.id), toUpdateInput(body));
    res.json(c);
  }),
);

containersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await svc.deleteContainer(routeParam(req.params.id));
    res.status(204).send();
  }),
);
