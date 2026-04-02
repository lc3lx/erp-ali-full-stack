import { AppError } from "./errors.js";

export function routeParam(value: string | string[] | undefined, name = "id"): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === undefined || v === "") throw new AppError(400, `Missing route parameter: ${name}`);
  return v;
}
