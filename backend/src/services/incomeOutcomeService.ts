import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";

const incomeOutcomeFieldNames = new Set(
  (Prisma.dmmf.datamodel.models.find((m) => m.name === "IncomeOutcomeEntry")?.fields ?? []).map(
    (field) => field.name,
  ),
);
const hasAmountUsd = incomeOutcomeFieldNames.has("amountUsd");
const hasLegacyUsdAmount = incomeOutcomeFieldNames.has("usdAmount");
const hasAmountRmb = incomeOutcomeFieldNames.has("amountRmb");
const hasAmountJineh = incomeOutcomeFieldNames.has("amountJineh");

export async function listIncomeOutcome(
  query: PaginationQuery & { date?: string; currency?: string; kind?: "EXPENSE" | "REVENUE" },
) {
  const { skip, take } = skipTake(query);
  const where: Prisma.IncomeOutcomeEntryWhereInput = {};
  if (query.currency) where.currency = query.currency;
  if (query.kind) where.kind = query.kind;
  if (query.date) {
    const d = new Date(query.date);
    if (!Number.isNaN(d.getTime())) {
      where.entryDate = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
  }
  const [items, total] = await Promise.all([
    prisma.incomeOutcomeEntry.findMany({
      where,
      skip,
      take,
      orderBy: { entryDate: "desc" },
    }),
    prisma.incomeOutcomeEntry.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getIncomeOutcomeEntry(id: string) {
  const e = await prisma.incomeOutcomeEntry.findUnique({ where: { id } });
  if (!e) throw new AppError(404, "Entry not found");
  return e;
}

export async function createIncomeOutcomeEntry(data: Prisma.IncomeOutcomeEntryCreateInput) {
  return prisma.incomeOutcomeEntry.create({ data });
}

export async function updateIncomeOutcomeEntry(id: string, data: Prisma.IncomeOutcomeEntryUpdateInput) {
  try {
    return await prisma.incomeOutcomeEntry.update({ where: { id }, data });
  } catch {
    throw new AppError(404, "Entry not found");
  }
}

export async function deleteIncomeOutcomeEntry(id: string) {
  await prisma.incomeOutcomeEntry.delete({ where: { id } });
}

export async function incomeOutcomeTotals(query: { date?: string; currency?: string; kind?: "EXPENSE" | "REVENUE" }) {
  const where: Prisma.IncomeOutcomeEntryWhereInput = {};
  if (query.currency) where.currency = query.currency;
  if (query.kind) where.kind = query.kind;
  if (query.date) {
    const d = new Date(query.date);
    if (!Number.isNaN(d.getTime())) {
      where.entryDate = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
  }
  const sumSelect: Record<string, true> = { fees: true };
  if (hasAmountUsd) sumSelect.amountUsd = true;
  else if (hasLegacyUsdAmount) sumSelect.usdAmount = true;
  if (hasAmountRmb) sumSelect.amountRmb = true;
  if (hasAmountJineh) sumSelect.amountJineh = true;

  const agg = await prisma.incomeOutcomeEntry.aggregate({
    where,
    _sum: sumSelect as Prisma.IncomeOutcomeEntrySumAggregateInputType,
    _count: true,
  });
  const sum = (((agg as unknown as { _sum?: Record<string, Prisma.Decimal | null | undefined> })._sum ??
    {}) as Record<string, Prisma.Decimal | null | undefined>);
  const amountUsd = sum.amountUsd ?? sum.usdAmount ?? null;

  return {
    count: agg._count,
    sumFees: sum.fees ?? null,
    sumAmountUsd: amountUsd,
    sumAmountRmb: sum.amountRmb ?? null,
    sumAmountJineh: sum.amountJineh ?? null,
  };
}
