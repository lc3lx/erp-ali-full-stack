import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";

function dec(n: Prisma.Decimal | null | undefined): number {
  if (n == null) return 0;
  return Number(n);
}

export async function listAccountingMoves(query: PaginationQuery) {
  const { skip, take } = skipTake(query);
  const [items, total] = await Promise.all([
    prisma.accountingMove.findMany({
      skip,
      take,
      orderBy: { moveDate: "desc" },
      include: { _count: { select: { lines: true } } },
    }),
    prisma.accountingMove.count(),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getAccountingMove(id: string) {
  const m = await prisma.accountingMove.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineDate: "asc" } } },
  });
  if (!m) throw new AppError(404, "Accounting move not found");
  return m;
}

export async function createAccountingMove(data: Prisma.AccountingMoveCreateInput) {
  return prisma.accountingMove.create({ data });
}

export async function updateAccountingMove(id: string, data: Prisma.AccountingMoveUpdateInput) {
  try {
    return await prisma.accountingMove.update({ where: { id }, data });
  } catch {
    throw new AppError(404, "Accounting move not found");
  }
}

export async function deleteAccountingMove(id: string) {
  await prisma.accountingMove.delete({ where: { id } });
}

export async function addAccountingLine(
  moveId: string,
  data: Prisma.AccountingLineCreateWithoutMoveInput,
) {
  await getAccountingMove(moveId);
  return prisma.accountingLine.create({
    data: { ...data, move: { connect: { id: moveId } } },
  });
}

export async function listAccountingLines(moveId: string) {
  await getAccountingMove(moveId);
  return prisma.accountingLine.findMany({ where: { moveId } });
}

export async function updateAccountingLine(
  moveId: string,
  lineId: string,
  data: Prisma.AccountingLineUpdateInput,
) {
  const line = await prisma.accountingLine.findFirst({ where: { id: lineId, moveId } });
  if (!line) throw new AppError(404, "Line not found");
  return prisma.accountingLine.update({ where: { id: lineId }, data });
}

export async function deleteAccountingLine(moveId: string, lineId: string) {
  const line = await prisma.accountingLine.findFirst({ where: { id: lineId, moveId } });
  if (!line) throw new AppError(404, "Line not found");
  await prisma.accountingLine.delete({ where: { id: lineId } });
}

export async function accountingTotals(moveId: string) {
  const lines = await prisma.accountingLine.findMany({ where: { moveId } });
  const out = { dinar: 0, jineh: 0, usd: 0, rmb: 0 };
  const inn = { dinar: 0, jineh: 0, usd: 0, rmb: 0 };
  for (const l of lines) {
    const bucket = l.direction === "OUT" ? out : inn;
    bucket.dinar += dec(l.dinar);
    bucket.jineh += dec(l.jineh);
    bucket.usd += dec(l.usd);
    bucket.rmb += dec(l.rmb);
  }
  return { out, in: inn, grand: {
    dinar: out.dinar + inn.dinar,
    jineh: out.jineh + inn.jineh,
    usd: out.usd + inn.usd,
    rmb: out.rmb + inn.rmb,
  } };
}

/** Customer + default sale discount for accounting UI search */
export async function searchCustomersWithDiscount(q: string) {
  return prisma.party.findMany({
    where: {
      type: "CUSTOMER",
      name: { contains: q, mode: "insensitive" },
    },
    take: 50,
    select: { id: true, name: true, saleDiscountDefault: true },
  });
}

export async function customerTotals(searchQuery: string) {
  const lines = await prisma.accountingLine.findMany({
    where: { move: { searchQuery } },
  });
  const out = { dinar: 0, jineh: 0, usd: 0, rmb: 0 };
  const inn = { dinar: 0, jineh: 0, usd: 0, rmb: 0 };
  for (const l of lines) {
    const bucket = l.direction === "OUT" ? out : inn;
    bucket.dinar += dec(l.dinar);
    bucket.jineh += dec(l.jineh);
    bucket.usd += dec(l.usd);
    bucket.rmb += dec(l.rmb);
  }
  return { out, in: inn, grand: {
    dinar: (inn.dinar - out.dinar), // depending on business logic, here we do (in - out) for net receipt
    jineh: (inn.jineh - out.jineh),
    usd: (inn.usd - out.usd),
    rmb: (inn.rmb - out.rmb),
  } };
}
