import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isAppError } from "../utils/errors.js";
import { Prisma } from "@prisma/client";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId ?? "unknown";

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
        requestId,
      },
    });
  }

  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code ?? "APP_ERROR",
        message: err.message,
        requestId,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        data: null,
        error: {
          code: "UNIQUE_VIOLATION",
          message: "Record already exists",
          requestId,
        },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: "NOT_FOUND",
          message: "Record not found",
          requestId,
        },
      });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        success: false,
        data: null,
        error: {
          code: "FK_VIOLATION",
          message: "لا يمكن تنفيذ العملية لوجود بيانات مرتبطة (مفتاح أجنبي).",
          requestId,
        },
      });
    }
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    data: null,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId,
    },
  });
}
