import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function skipTake(p: PaginationQuery) {
  return { skip: (p.page - 1) * p.pageSize, take: p.pageSize };
}
