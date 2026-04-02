import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import type { Prisma } from "@prisma/client";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";

export async function listOfficialDocuments(query: PaginationQuery) {
  const { skip, take } = skipTake(query);
  const [items, total] = await Promise.all([
    prisma.officialDocument.findMany({ skip, take, orderBy: { updatedAt: "desc" } }),
    prisma.officialDocument.count(),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getOfficialDocument(id: string) {
  const d = await prisma.officialDocument.findUnique({ where: { id } });
  if (!d) throw new AppError(404, "Document not found");
  return d;
}

export async function createOfficialDocument(data: Prisma.OfficialDocumentCreateInput) {
  return prisma.officialDocument.create({ data });
}

export async function updateOfficialDocument(id: string, data: Prisma.OfficialDocumentUpdateInput) {
  try {
    return await prisma.officialDocument.update({ where: { id }, data });
  } catch {
    throw new AppError(404, "Document not found");
  }
}

export async function deleteOfficialDocument(id: string) {
  await prisma.officialDocument.delete({ where: { id } });
}
