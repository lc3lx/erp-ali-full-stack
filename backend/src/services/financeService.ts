import {
  Prisma,
  type FiscalPeriodStatus,
  type GlAccountClass,
  type JournalEntryStatus,
  type JournalSourceType,
} from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";
import * as invStock from "./inventoryStockService.js";

const EPS = new Prisma.Decimal("0.0001");
const FUNC_CURRENCY = "USD";

function d(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

async function audit(
  tx: Prisma.TransactionClient,
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details?: unknown,
) {
  await tx.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      entityType,
      entityId,
      details: details === undefined ? undefined : (details as Prisma.InputJsonValue),
    },
  });
}

async function nextJournalNo(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.documentSequence.findUnique({ where: { key: "JOURNAL" } });
  if (!existing) {
    await tx.documentSequence.create({ data: { key: "JOURNAL", prefix: "JE", nextNum: 1 } });
  }
  const updated = await tx.documentSequence.update({
    where: { key: "JOURNAL" },
    data: { nextNum: { increment: 1 } },
  });
  const num = updated.nextNum - 1;
  return `${updated.prefix}-${String(num).padStart(6, "0")}`;
}

export async function findOpenPeriodForDate(entryDate: Date) {
  return prisma.fiscalPeriod.findFirst({
    where: {
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
      status: "OPEN",
    },
    include: { year: true },
  });
}

/* ----- Chart of accounts ----- */

export async function listGlAccounts(query: { q?: string; class?: GlAccountClass; activeOnly?: boolean }) {
  const where: Prisma.GlAccountWhereInput = {};
  if (query.class) where.class = query.class;
  if (query.activeOnly !== false) where.isActive = true;
  if (query.q?.trim()) {
    where.OR = [
      { code: { contains: query.q.trim(), mode: "insensitive" } },
      { name: { contains: query.q.trim(), mode: "insensitive" } },
      { nameAr: { contains: query.q.trim(), mode: "insensitive" } },
    ];
  }
  return prisma.glAccount.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getGlAccount(id: string) {
  const a = await prisma.glAccount.findUnique({ where: { id } });
  if (!a) throw new AppError(404, "Account not found");
  return a;
}

export async function createGlAccount(data: {
  code: string;
  name: string;
  nameAr?: string | null;
  class: GlAccountClass;
  parentId?: string | null;
  isPosting?: boolean;
  sortOrder?: number;
}, userId?: string) {
  const code = data.code.trim();
  const dup = await prisma.glAccount.findUnique({ where: { code } });
  if (dup) throw new AppError(409, "Account code already exists");
  const a = await prisma.glAccount.create({
    data: {
      code,
      name: data.name.trim(),
      nameAr: data.nameAr?.trim() || null,
      class: data.class,
      parentId: data.parentId || null,
      isPosting: data.isPosting ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "CREATE_GL_ACCOUNT",
      entityType: "GlAccount",
      entityId: a.id,
      details: { code: a.code },
    },
  });
  return a;
}

export async function updateGlAccount(
  id: string,
  data: Partial<{
    name: string;
    nameAr: string | null;
    parentId: string | null;
    isPosting: boolean;
    isActive: boolean;
    sortOrder: number;
  }>,
  userId?: string,
) {
  await getGlAccount(id);
  const a = await prisma.glAccount.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.nameAr !== undefined ? { nameAr: data.nameAr } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      ...(data.isPosting !== undefined ? { isPosting: data.isPosting } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "UPDATE_GL_ACCOUNT",
      entityType: "GlAccount",
      entityId: id,
      details: data as object,
    },
  });
  return a;
}

export async function deleteGlAccount(id: string, userId?: string) {
  const linkedLines = await prisma.journalLine.count({ where: { accountId: id } });
  if (linkedLines > 0) throw new AppError(409, "لا يمكن حذف الحساب لوجود قيود مرتبطة");
  await prisma.glAccount.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: userId ?? null, action: "DELETE_GL_ACCOUNT", entityType: "GlAccount", entityId: id },
  });
}

/* ----- Fiscal ----- */

export async function listFiscalYears() {
  return prisma.fiscalYear.findMany({
    orderBy: { startDate: "desc" },
    include: { periods: { orderBy: { index: "asc" } } },
  });
}

export async function createFiscalYear(label: string, startDate: Date, endDate: Date, userId?: string) {
  if (startDate >= endDate) throw new AppError(400, "startDate must be before endDate");
  const overlap = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) throw new AppError(409, "Fiscal year overlaps an existing year");

  const year = await prisma.$transaction(async (tx) => {
    const y = await tx.fiscalYear.create({
      data: { label: label.trim(), startDate, endDate },
    });
    let idx = 1;
    let curStart = new Date(startDate);
    while (curStart <= endDate) {
      const monthEnd = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 0, 23, 59, 59, 999);
      const pEnd = monthEnd > endDate ? endDate : monthEnd;
      await tx.fiscalPeriod.create({
        data: {
          yearId: y.id,
          index: idx,
          name: `${curStart.getFullYear()}-${String(curStart.getMonth() + 1).padStart(2, "0")}`,
          startDate: curStart,
          endDate: pEnd,
          status: "OPEN",
        },
      });
      idx += 1;
      curStart = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 1);
      if (idx > 36) break;
    }
    await audit(tx, userId, "CREATE_FISCAL_YEAR", "FiscalYear", y.id, { label });
    return tx.fiscalYear.findUniqueOrThrow({
      where: { id: y.id },
      include: { periods: { orderBy: { index: "asc" } } },
    });
  });
  return year;
}

export async function setPeriodStatus(id: string, status: FiscalPeriodStatus, userId?: string) {
  const p = await prisma.fiscalPeriod.findUnique({ where: { id } });
  if (!p) throw new AppError(404, "Period not found");
  const updated = await prisma.fiscalPeriod.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "UPDATE_FISCAL_PERIOD",
      entityType: "FiscalPeriod",
      entityId: id,
      details: { status },
    },
  });
  return updated;
}

export async function deleteFiscalYear(id: string, userId?: string) {
  const year = await prisma.fiscalYear.findUnique({ where: { id }, include: { periods: true } });
  if (!year) throw new AppError(404, "Fiscal year not found");
  const periodIds = year.periods.map((p) => p.id);
  const entriesCount = await prisma.journalEntry.count({ where: { periodId: { in: periodIds } } });
  if (entriesCount > 0) throw new AppError(409, "لا يمكن حذف السنة المالية لوجود قيود");
  await prisma.fiscalYear.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: userId ?? null, action: "DELETE_FISCAL_YEAR", entityType: "FiscalYear", entityId: id },
  });
}

export async function closeYear(
  id: string,
  input: { retainedEarningsAccountId: string; closeDate?: Date },
  userId?: string,
) {
  const year = await prisma.fiscalYear.findUnique({
    where: { id },
    include: { periods: true },
  });
  if (!year) throw new AppError(404, "Fiscal year not found");
  if (year.isClosed) throw new AppError(409, "Fiscal year already closed");
  const closeDate = input.closeDate ?? year.endDate;
  const pnl = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: { status: "POSTED", entryDate: { gte: year.startDate, lte: year.endDate } },
      account: { class: { in: ["REVENUE", "EXPENSE"] } },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const accounts = await prisma.glAccount.findMany({ where: { id: { in: pnl.map((x) => x.accountId) } } });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const lines: LineInput[] = [];
  let netIncome = d(0);
  for (const row of pnl) {
    const acc = accountById.get(row.accountId);
    if (!acc) continue;
    const dr = d(row._sum.debitBase);
    const cr = d(row._sum.creditBase);
    if (acc.class === "REVENUE") {
      const bal = cr.minus(dr);
      if (bal.gt(0)) {
        lines.push({ accountId: row.accountId, debit: bal.toString(), credit: "0", description: "إقفال إيرادات" });
        netIncome = netIncome.add(bal);
      }
    } else if (acc.class === "EXPENSE") {
      const bal = dr.minus(cr);
      if (bal.gt(0)) {
        lines.push({ accountId: row.accountId, debit: "0", credit: bal.toString(), description: "إقفال مصروفات" });
        netIncome = netIncome.minus(bal);
      }
    }
  }
  if (lines.length === 0) throw new AppError(409, "لا توجد أرصدة إيرادات/مصروفات لإقفالها");
  if (netIncome.gte(0)) {
    lines.push({
      accountId: input.retainedEarningsAccountId,
      debit: "0",
      credit: netIncome.toString(),
      description: "صافي نتيجة السنة",
    });
  } else {
    lines.push({
      accountId: input.retainedEarningsAccountId,
      debit: netIncome.abs().toString(),
      credit: "0",
      description: "صافي نتيجة السنة",
    });
  }
  return prisma.$transaction(async (tx) => {
    const je = await createPostedJournal(
      {
        entryDate: closeDate,
        description: `قيد إقفال السنة ${year.label}`,
        sourceType: "MANUAL",
        sourceId: year.id,
        lines,
        userId,
      },
      tx,
    );
    await tx.fiscalYear.update({ where: { id }, data: { isClosed: true } });
    await tx.fiscalPeriod.updateMany({ where: { yearId: id }, data: { status: "CLOSED" } });
    await audit(tx, userId, "CLOSE_FISCAL_YEAR", "FiscalYear", id, { journalEntryId: je.id });
    return je;
  });
}

/* ----- Journal entries ----- */

type LineInput = {
  accountId: string;
  description?: string | null;
  partyId?: string | null;
  containerId?: string | null;
  storeId?: string | null;
  currency?: string;
  exchangeRate?: number | string | null;
  debit?: number | string | null;
  credit?: number | string | null;
};

function validateBalancedLines(
  lines: { debitBase: Prisma.Decimal; creditBase: Prisma.Decimal }[],
) {
  let dr = d(0);
  let cr = d(0);
  for (const l of lines) {
    dr = dr.add(l.debitBase);
    cr = cr.add(l.creditBase);
  }
  if (dr.minus(cr).abs().gt(EPS)) {
    throw new AppError(400, "Journal is not balanced (debit ≠ credit in base currency)");
  }
  if (lines.length < 2) {
    throw new AppError(400, "Journal must have at least two lines");
  }
}

function mapLineToRow(lineNo: number, l: LineInput) {
  const debit = d(l.debit ?? 0);
  const credit = d(l.credit ?? 0);
  if (debit.gt(0) && credit.gt(0)) throw new AppError(400, "Line cannot have both debit and credit");
  const ex = l.exchangeRate != null ? d(l.exchangeRate) : d(1);
  if (ex.lte(0)) throw new AppError(400, "exchangeRate must be positive");
  const debitBase = debit.mul(ex);
  const creditBase = credit.mul(ex);
  return {
    lineNo,
    accountId: l.accountId,
    description: l.description?.trim() || null,
    partyId: l.partyId || null,
    containerId: l.containerId || null,
    storeId: l.storeId || null,
    currency: (l.currency ?? FUNC_CURRENCY).trim() || FUNC_CURRENCY,
    exchangeRate: ex,
    debit,
    credit,
    debitBase,
    creditBase,
  };
}

async function assertAccountsPostable(accountIds: string[]) {
  const accs = await prisma.glAccount.findMany({ where: { id: { in: accountIds } } });
  if (accs.length !== accountIds.length) throw new AppError(400, "Unknown account in lines");
  for (const a of accs) {
    if (!a.isActive) throw new AppError(400, `Account ${a.code} is inactive`);
    if (!a.isPosting) throw new AppError(400, `Account ${a.code} is not a posting account`);
  }
}

async function assertAccountsPostableTx(tx: Prisma.TransactionClient, accountIds: string[]) {
  const accs = await tx.glAccount.findMany({ where: { id: { in: accountIds } } });
  if (accs.length !== accountIds.length) throw new AppError(400, "Unknown account in lines");
  for (const a of accs) {
    if (!a.isActive) throw new AppError(400, `Account ${a.code} is inactive`);
    if (!a.isPosting) throw new AppError(400, `Account ${a.code} is not a posting account`);
  }
}

function findOpenPeriodTx(tx: Prisma.TransactionClient, entryDate: Date) {
  return tx.fiscalPeriod.findFirst({
    where: {
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
      status: "OPEN",
    },
    include: { year: true },
  });
}

/** يُنشئ قيداً مرحّلاً مباشرة (للترحيل من فواتير وغيرها). يدعم معاملة خارجية. */
export async function createPostedJournal(
  input: {
    entryDate: Date;
    description?: string;
    sourceType: JournalSourceType;
    sourceId: string;
    lines: LineInput[];
    userId?: string;
    companyId?: string | null;
  },
  outerTx?: Prisma.TransactionClient,
) {
  const run = async (tx: Prisma.TransactionClient) => {
    const period = await findOpenPeriodTx(tx, input.entryDate);
    if (!period) throw new AppError(400, "No open fiscal period for this date");
    const rows = input.lines.map((l, i) => mapLineToRow(i + 1, l));
    validateBalancedLines(rows);
    await assertAccountsPostableTx(tx, rows.map((r) => r.accountId));
    const entryNo = await nextJournalNo(tx);
    const e = await tx.journalEntry.create({
      data: {
        entryNo,
        entryDate: input.entryDate,
        periodId: period.id,
        status: "POSTED",
        postedAt: new Date(),
        description: input.description?.trim() || null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdById: input.userId ?? null,
        companyId: input.companyId ?? null,
        lines: { create: rows },
      },
      include: { lines: true, period: { include: { year: true } } },
    });
    await audit(tx, input.userId, "CREATE_POSTED_JE", "JournalEntry", e.id, {
      entryNo,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    return e;
  };
  if (outerTx) return run(outerTx);
  return prisma.$transaction(run);
}

export async function listJournalEntries(query: PaginationQuery & { status?: JournalEntryStatus }) {
  const { skip, take } = skipTake(query);
  const where: Prisma.JournalEntryWhereInput = {};
  if (query.status) where.status = query.status;
  const [items, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      skip,
      take,
      orderBy: { entryDate: "desc" },
      include: { period: { include: { year: true } }, lines: true },
    }),
    prisma.journalEntry.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getJournalEntry(id: string) {
  const e = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineNo: "asc" } }, period: { include: { year: true } } },
  });
  if (!e) throw new AppError(404, "Journal entry not found");
  return e;
}

export async function createJournalEntry(
  input: { entryDate: Date; description?: string; lines: LineInput[] },
  userId?: string,
) {
  if (!input.lines?.length) throw new AppError(400, "At least one line required");
  const period = await findOpenPeriodForDate(input.entryDate);
  if (!period) throw new AppError(400, "No open fiscal period for this date");

  const rows = input.lines.map((l, i) => mapLineToRow(i + 1, l));
  validateBalancedLines(rows);
  await assertAccountsPostable(rows.map((r) => r.accountId));

  return prisma.$transaction(async (tx) => {
    const entryNo = await nextJournalNo(tx);
    const e = await tx.journalEntry.create({
      data: {
        entryNo,
        entryDate: input.entryDate,
        periodId: period.id,
        status: "DRAFT",
        description: input.description?.trim() || null,
        sourceType: "MANUAL",
        createdById: userId ?? null,
        lines: { create: rows },
      },
      include: { lines: true, period: { include: { year: true } } },
    });
    await audit(tx, userId, "CREATE_JE", "JournalEntry", e.id, { entryNo, lineCount: rows.length });
    return e;
  });
}

export async function updateJournalEntryDraft(
  id: string,
  patch: { entryDate?: Date; description?: string | null },
  userId?: string,
) {
  const e = await getJournalEntry(id);
  if (e.status !== "DRAFT") throw new AppError(409, "Only draft entries can be edited");

  let periodId = e.periodId;
  if (patch.entryDate) {
    const p = await findOpenPeriodForDate(patch.entryDate);
    if (!p) throw new AppError(400, "No open fiscal period for this date");
    periodId = p.id;
  }

  const updated = await prisma.journalEntry.update({
    where: { id },
    data: {
      ...(patch.entryDate ? { entryDate: patch.entryDate } : {}),
      ...(patch.entryDate ? { periodId } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
    },
    include: { lines: true, period: { include: { year: true } } },
  });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "UPDATE_JE",
      entityType: "JournalEntry",
      entityId: id,
      details: patch,
    },
  });
  return updated;
}

export async function replaceJournalLinesDraft(id: string, lines: LineInput[], userId?: string) {
  const e = await getJournalEntry(id);
  if (e.status !== "DRAFT") throw new AppError(409, "Only draft entries can be edited");
  if (!lines?.length) throw new AppError(400, "At least one line required");

  const rows = lines.map((l, i) => mapLineToRow(i + 1, l));
  validateBalancedLines(rows);
  await assertAccountsPostable(rows.map((r) => r.accountId));

  await prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
    await tx.journalLine.createMany({ data: rows.map((r) => ({ ...r, journalEntryId: id })) });
    await audit(tx, userId, "REPLACE_JE_LINES", "JournalEntry", id, { lineCount: rows.length });
  });
  return getJournalEntry(id);
}

export async function postJournalEntry(id: string, userId?: string) {
  const e = await getJournalEntry(id);
  if (e.status !== "DRAFT") throw new AppError(409, "Only draft entries can be posted");
  if (e.period.status !== "OPEN") throw new AppError(409, "Fiscal period is not open");
  const rows = e.lines.map((l) => ({ debitBase: l.debitBase, creditBase: l.creditBase }));
  validateBalancedLines(rows);

  const updated = await prisma.journalEntry.update({
    where: { id },
    data: {
      status: "POSTED",
      postedAt: new Date(),
    },
    include: { lines: true, period: { include: { year: true } } },
  });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "POST_JE",
      entityType: "JournalEntry",
      entityId: id,
      details: { entryNo: e.entryNo },
    },
  });
  return updated;
}

export async function voidJournalEntry(id: string, userId?: string) {
  const e = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: true,
      period: { include: { year: true } },
      saleVoucherSource: { select: { id: true } },
      purchaseVoucherSrc: { select: { id: true } },
    },
  });
  if (!e) throw new AppError(404, "Journal entry not found");
  if (e.status !== "POSTED") throw new AppError(409, "Only posted entries can be voided");
  const saleId = e.saleVoucherSource?.id;
  const purchaseId = e.purchaseVoucherSrc?.id;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.journalEntry.update({
      where: { id },
      data: { status: "VOID", voidedAt: new Date() },
      include: { lines: true, period: { include: { year: true } } },
    });
    await tx.saleVoucher.updateMany({ where: { glJournalEntryId: id }, data: { glJournalEntryId: null } });
    await tx.purchaseInvoiceVoucher.updateMany({
      where: { glJournalEntryId: id },
      data: { glJournalEntryId: null },
    });
    await tx.incomeOutcomeEntry.updateMany({
      where: { glJournalEntryId: id },
      data: { glJournalEntryId: null },
    });
    await tx.treasuryPayment.updateMany({ where: { glJournalEntryId: id }, data: { glJournalEntryId: null } });
    await tx.treasuryTransfer.updateMany({ where: { glJournalEntryId: id }, data: { glJournalEntryId: null } });
    if (saleId) {
      await invStock.removeInventoryMovesForReference(tx, saleId, ["SALE_VOUCHER"]);
    }
    if (purchaseId) {
      await invStock.removeInventoryMovesForReference(tx, purchaseId, ["PURCHASE_VOUCHER"]);
    }
    await audit(tx, userId, "VOID_JE", "JournalEntry", id, { entryNo: e.entryNo });
    return updated;
  });
}

export async function deleteJournalEntryDraft(id: string, userId?: string) {
  const e = await getJournalEntry(id);
  if (e.status !== "DRAFT") throw new AppError(409, "Only draft entries can be deleted");
  await prisma.journalEntry.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "DELETE_JE",
      entityType: "JournalEntry",
      entityId: id,
      details: { entryNo: e.entryNo },
    },
  });
}

/* ----- Reports ----- */

export async function trialBalance(from: Date, to: Date) {
  const sums = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        status: "POSTED",
        entryDate: { gte: from, lte: to },
      },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const accounts = await prisma.glAccount.findMany({
    where: { id: { in: sums.map((s) => s.accountId) } },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return sums.map((s) => ({
    accountId: s.accountId,
    code: byId.get(s.accountId)?.code ?? "",
    name: byId.get(s.accountId)?.name ?? "",
    debit: d(s._sum.debitBase).toFixed(4),
    credit: d(s._sum.creditBase).toFixed(4),
    balance: d(s._sum.debitBase).minus(d(s._sum.creditBase)).toFixed(4),
  }));
}

export async function trialBalanceSummary(from: Date, to: Date) {
  const agg = await prisma.journalLine.aggregate({
    where: {
      journalEntry: {
        status: "POSTED",
        entryDate: { gte: from, lte: to },
      },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const totalDebit = d(agg._sum.debitBase);
  const totalCredit = d(agg._sum.creditBase);
  const diff = totalDebit.minus(totalCredit);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalDebit: totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    difference: diff.toFixed(4),
    isBalanced: diff.abs().lte(EPS),
  };
}

export async function assertTrialBalanceBalanced(
  tx: Prisma.TransactionClient,
  from: Date,
  to: Date,
  context: string,
) {
  const agg = await tx.journalLine.aggregate({
    where: {
      journalEntry: {
        status: "POSTED",
        entryDate: { gte: from, lte: to },
      },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const dr = d(agg._sum.debitBase);
  const cr = d(agg._sum.creditBase);
  if (dr.minus(cr).abs().gt(EPS)) {
    throw new AppError(409, `Trial balance mismatch after ${context}`);
  }
}

export async function accountLedger(accountId: string, from: Date, to: Date) {
  await getGlAccount(accountId);

  const [openingAgg] = await Promise.all([
    prisma.journalLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          status: "POSTED",
          entryDate: { lt: from },
        },
      },
      _sum: { debitBase: true, creditBase: true },
    }),
  ]);

  let running = d(openingAgg._sum.debitBase).minus(d(openingAgg._sum.creditBase));
  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      journalEntry: {
        status: "POSTED",
        entryDate: { gte: from, lte: to },
      },
    },
    include: {
      journalEntry: { select: { id: true, entryNo: true, entryDate: true, description: true } },
    },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { lineNo: "asc" }],
  });

  const rows = lines.map((l) => {
    const dr = d(l.debitBase);
    const cr = d(l.creditBase);
    running = running.add(dr).minus(cr);
    return {
      entryId: l.journalEntry.id,
      entryNo: l.journalEntry.entryNo,
      entryDate: l.journalEntry.entryDate,
      description: l.description ?? l.journalEntry.description,
      debit: dr.toFixed(4),
      credit: cr.toFixed(4),
      balance: running.toFixed(4),
    };
  });

  return {
    openingBalance: d(openingAgg._sum.debitBase).minus(d(openingAgg._sum.creditBase)).toFixed(4),
    rows,
  };
}

export async function listAuditLogs(
  query: PaginationQuery & {
    entityType?: string;
    entityId?: string;
    userId?: string;
    from?: Date;
    to?: Date;
  },
) {
  const { skip, take } = skipTake(query);
  const where: Prisma.AuditLogWhereInput = {};
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.userId) where.userId = query.userId;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
