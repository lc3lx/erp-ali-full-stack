import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as notify from "../services/notificationService.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { routeParam } from "../utils/params.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requirePermission("notifications:read"),
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        unreadOnly: z.enum(["true", "false"]).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query);
    const take = q.pageSize ?? 30;
    const skip = ((q.page ?? 1) - 1) * take;
    res.json(
      await notify.listForUser(req.user!.id, {
        unreadOnly: q.unreadOnly === "true",
        skip,
        take,
      }),
    );
  }),
);

notificationsRouter.patch(
  "/:id/read",
  requirePermission("notifications:read"),
  asyncHandler(async (req, res) => {
    const row = await notify.markRead(req.user!.id, routeParam(req.params.id));
    res.json(row ?? { ok: false });
  }),
);

notificationsRouter.post(
  "/read-all",
  requirePermission("notifications:read"),
  asyncHandler(async (req, res) => {
    await notify.markAllRead(req.user!.id);
    res.json({ ok: true });
  }),
);
