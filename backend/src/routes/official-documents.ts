import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import * as svc from "../services/officialDocumentService.js";
import { routeParam } from "../utils/params.js";

export const officialDocumentsRouter = Router();

const listQuery = paginationQuerySchema;

const docBody = z.object({
  serial1: z.string().optional().nullable(),
  serial2: z.string().optional().nullable(),
  serial3: z.string().optional().nullable(),
  recipient: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  body: z.string(),
  printAddr: z.string().default("pride"),
  printType: z.string().default("with"),
  hideNumDate: z.boolean().optional(),
  party1Name: z.string().optional().nullable(),
  party1Address: z.string().optional().nullable(),
  party2Name: z.string().optional().nullable(),
  party2Address: z.string().optional().nullable(),
  party3Name: z.string().optional().nullable(),
  party3Address: z.string().optional().nullable(),
});

function toCreate(body: z.infer<typeof docBody>): Prisma.OfficialDocumentCreateInput {
  return { ...body };
}

function toUpdate(body: Partial<z.infer<typeof docBody>>): Prisma.OfficialDocumentUpdateInput {
  return body;
}

officialDocumentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    res.json(await svc.listOfficialDocuments(q));
  }),
);

officialDocumentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = docBody.parse(req.body);
    const d = await svc.createOfficialDocument(toCreate(body));
    res.status(201).json(d);
  }),
);

officialDocumentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await svc.getOfficialDocument(routeParam(req.params.id)));
  }),
);

officialDocumentsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = docBody.partial().parse(req.body);
    res.json(await svc.updateOfficialDocument(routeParam(req.params.id), toUpdate(body)));
  }),
);

officialDocumentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await svc.deleteOfficialDocument(routeParam(req.params.id));
    res.status(204).send();
  }),
);
