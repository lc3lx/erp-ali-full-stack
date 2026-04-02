import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { prisma } from "../db/client.js";
import type { UserRole } from "@prisma/client";

type JwtPayload = { sub: string; email: string; role: UserRole };

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing bearer token", "UNAUTHORIZED"));
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) return next(new AppError(401, "Invalid token", "UNAUTHORIZED"));
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    next(new AppError(401, "Invalid token", "UNAUTHORIZED"));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Unauthorized", "UNAUTHORIZED"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Forbidden", "FORBIDDEN"));
    }
    next();
  };
}
