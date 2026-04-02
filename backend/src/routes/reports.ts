import { Router } from "express";
import { z } from "zod";
import { ContainerStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { runReport, type ReportTab } from "../services/reportService.js";

export const reportsRouter = Router();

const tabSchema = z.enum(["cust", "item", "mat-inv", "all-moves", "cont-inv", "cont-sale"]);

reportsRouter.get(
  "/run",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        tab: tabSchema.default("cont-inv"),
        status: z
          .preprocess((val) => {
            if (val === undefined || val === null || val === "") return undefined;
            const s = String(val).toLowerCase();
            if (s === "all") return "all";
            if (s === "open") return "OPEN";
            if (s === "closed") return "CLOSED";
            if (s === "received") return "RECEIVED";
            if (s === "in_transit" || s === "in-transit") return "IN_TRANSIT";
            if (s === "arrived") return "ARRIVED";
            if (s === "customs_cleared" || s === "cleared") return "CUSTOMS_CLEARED";
            return val;
          }, z.union([z.nativeEnum(ContainerStatus), z.literal("all")]).optional()),
        containerNo: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        receivingCompany: z.string().optional(),
        fromNo: z.string().optional(),
        toNo: z.string().optional(),
        releaseExport: z
          .string()
          .optional()
          .transform((v) => v === "true" || v === "1"),
      })
      .parse(req.query);

    const result = await runReport(q.tab as ReportTab, {
      status: q.status,
      containerNo: q.containerNo,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      receivingCompany: q.receivingCompany,
      fromNo: q.fromNo,
      toNo: q.toNo,
      releaseExport: q.releaseExport,
    });
    res.json(result);
  }),
);
