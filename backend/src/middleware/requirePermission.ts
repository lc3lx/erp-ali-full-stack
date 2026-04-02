import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { type PermissionKey, resolvePermission } from "../domain/permissions/registry.js";

let cachedBypassEmptyTable: boolean | null = null;

async function tableHasAnyPermission(): Promise<boolean> {
  if (cachedBypassEmptyTable !== null) return !cachedBypassEmptyTable;
  const n = await prisma.rolePermission.count();
  cachedBypassEmptyTable = n === 0;
  return n > 0;
}

/**
 * يتحقق من RolePermission. ADMIN دائماً مسموح.
 * إذا لم يُسجَّل أي صف في الجدول بعد — وضع ترحيل: يسمح للجميع (للإبقاء على التشغيل حتى يُبذَر الجدول).
 */
export function requirePermission(key: PermissionKey | string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Unauthorized", "UNAUTHORIZED"));

    const role = req.user.role as UserRole;
    if (role === "ADMIN") return next();

    const hasTable = await tableHasAnyPermission();
    if (!hasTable) return next();

    const { module, action } = resolvePermission(key);
    const row = await prisma.rolePermission.findUnique({
      where: {
        role_module_action: { role, module, action },
      },
    });
    if (row?.allowed) return next();

    return next(
      new AppError(403, `Forbidden: missing permission ${String(key)}`, "PERMISSION_DENIED"),
    );
  };
}
