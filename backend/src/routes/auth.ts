import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registerUser, login } from "../services/authService.js";
import { prisma } from "../db/client.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { AppError } from "../utils/errors.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "USER", "ACCOUNTANT", "STORE_KEEPER", "DATA_ENTRY"]).optional(),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await login(body.email, body.password);
    res.json(result);
  }),
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const count = await prisma.user.count();
    if (count > 0) {
      throw new AppError(
        403,
        "Use an admin account to create users, or seed the database.",
        "REGISTER_DISABLED",
      );
    }
    const user = await registerUser(body.email, body.password, body.role ?? "ADMIN");
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  }),
);

authRouter.post(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const user = await registerUser(body.email, body.password, body.role ?? "USER");
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  }),
);
