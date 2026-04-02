import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, service: "container-backend" });
  }),
);

healthRouter.get(
  "/health/live",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, service: "container-backend", check: "live" });
  }),
);

healthRouter.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "container-backend", check: "ready" });
  }),
);
