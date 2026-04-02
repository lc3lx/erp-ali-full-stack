import type { Response } from "express";

/** Envelope موحّد للـ API (يتوافق تدريجياً مع الواجهة) */
export type ApiSuccess<T> = {
  success: true;
  data: T;
  error: null;
  meta?: { requestId?: string; page?: number; pageSize?: number; total?: number };
};

export type ApiFailure = {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
};

export function sendSuccess<T>(res: Response, data: T, status = 200, meta?: ApiSuccess<T>["meta"]) {
  const body: ApiSuccess<T> = { success: true, data, error: null, ...(meta ? { meta } : {}) };
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T) {
  return sendSuccess(res, data, 201);
}
