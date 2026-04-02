import { Prisma, type BankStatementLineStatus } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";

const EPS = new Prisma.Decimal("0.0001");

function dec(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

export type ImportLineInput = {
  txnDate: Date;
  amount: number | string | Prisma.Decimal;
  description?: string | null;
  bankReference?: string | null;
  rawPayload?: unknown;
};

export async function importBankStatement(input: {
  cashBankId: string;
  companyId?: string | null;
  sourceName?: string | null;
  metadata?: Prisma.InputJsonValue;
  lines: ImportLineInput[];
  userId?: string;
}) {
  if (!input.lines.length) throw new AppError(400, "No statement lines to import");
  const bank = await prisma.cashBankAccount.findUnique({ where: { id: input.cashBankId } });
  if (!bank) throw new AppError(404, "Cash/Bank account not found");

  return prisma.$transaction(async (tx) => {
    const stmt = await tx.bankStatement.create({
      data: {
        cashBankId: input.cashBankId,
        companyId: input.companyId ?? null,
        sourceName: input.sourceName?.trim() || null,
        metadata: input.metadata ?? undefined,
        createdById: input.userId ?? null,
        lines: {
          create: input.lines.map((l, idx) => ({
            lineIndex: idx,
            txnDate: l.txnDate,
            amount: dec(l.amount),
            description: l.description?.trim() || null,
            bankReference: l.bankReference?.trim() || null,
            rawPayload: l.rawPayload === undefined ? undefined : (l.rawPayload as Prisma.InputJsonValue),
            status: "UNMATCHED" as BankStatementLineStatus,
          })),
        },
      },
      include: { lines: { orderBy: { lineIndex: "asc" } }, cashBank: true },
    });
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "BANK_STATEMENT_IMPORT",
        entityType: "BankStatement",
        entityId: stmt.id,
        details: { lineCount: stmt.lines.length, cashBankId: stmt.cashBankId } as Prisma.InputJsonValue,
      },
    });
    return stmt;
  });
}

export async function getBankStatement(id: string) {
  const s = await prisma.bankStatement.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { lineIndex: "asc" }, include: { matchedPayment: { include: { glJournalEntry: true } } } },
      cashBank: true,
    },
  });
  if (!s) throw new AppError(404, "Bank statement not found");
  return s;
}

export async function listBankStatements(filters: { cashBankId?: string; companyId?: string | null }) {
  const where: Prisma.BankStatementWhereInput = {};
  if (filters.cashBankId) where.cashBankId = filters.cashBankId;
  if (filters.companyId !== undefined && filters.companyId !== null) where.companyId = filters.companyId;
  return prisma.bankStatement.findMany({
    where,
    orderBy: { importedAt: "desc" },
    include: { cashBank: true, _count: { select: { lines: true } } },
  });
}

/** مطابقة يدوية: يجب أن يتطابق الصندوق، والمبلغ، واتجاه الحركة مع سند الخزينة. */
export async function matchStatementLineToPayment(input: {
  statementLineId: string;
  paymentId: string;
  userId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.bankStatementLine.findUnique({
      where: { id: input.statementLineId },
      include: { statement: true },
    });
    if (!line) throw new AppError(404, "Statement line not found");
    if (line.status === "MATCHED") throw new AppError(409, "Line already matched");
    if (line.status === "IGNORED") throw new AppError(400, "Ignored lines cannot be matched");

    const pay = await tx.treasuryPayment.findUnique({ where: { id: input.paymentId } });
    if (!pay) throw new AppError(404, "Treasury payment not found");
    if (pay.cashBankId !== line.statement.cashBankId) {
      throw new AppError(400, "Payment bank account does not match statement");
    }

    const lineAmt = line.amount;
    const payAmt = pay.amount;
    if (lineAmt.abs().minus(payAmt.abs()).abs().gt(EPS)) {
      throw new AppError(400, "Statement amount and payment amount do not match");
    }
    const lineSign = lineAmt.gt(0) ? 1 : lineAmt.lt(0) ? -1 : 0;
    const paySign = pay.direction === "RECEIPT" ? 1 : -1;
    if (lineSign !== 0 && lineSign !== paySign) {
      throw new AppError(400, "Statement line sign does not match payment direction (receipt vs disbursement)");
    }

    await tx.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: "MATCHED",
        matchedPaymentId: pay.id,
        matchedAt: new Date(),
        matchedById: input.userId ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "BANK_STATEMENT_MATCH",
        entityType: "BankStatementLine",
        entityId: line.id,
        details: { paymentId: pay.id } as Prisma.InputJsonValue,
      },
    });
    return getBankStatement(line.statementId);
  });
}

export async function unmatchStatementLine(statementLineId: string, userId?: string) {
  await prisma.$transaction(async (tx) => {
    const line = await tx.bankStatementLine.findUnique({ where: { id: statementLineId } });
    if (!line) throw new AppError(404, "Statement line not found");
    if (line.status !== "MATCHED") throw new AppError(400, "Only matched lines can be unmatched");
    await tx.bankStatementLine.update({
      where: { id: statementLineId },
      data: {
        status: "UNMATCHED",
        matchedPaymentId: null,
        matchedAt: null,
        matchedById: null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "BANK_STATEMENT_UNMATCH",
        entityType: "BankStatementLine",
        entityId: statementLineId,
      },
    });
  });
}

export async function setStatementLineIgnored(statementLineId: string, userId?: string) {
  const line = await prisma.bankStatementLine.findUnique({ where: { id: statementLineId } });
  if (!line) throw new AppError(404, "Statement line not found");
  if (line.status === "MATCHED") throw new AppError(400, "Cannot ignore a matched line");
  const updated = await prisma.bankStatementLine.update({
    where: { id: statementLineId },
    data: { status: "IGNORED" },
  });
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action: "BANK_STATEMENT_IGNORE",
      entityType: "BankStatementLine",
      entityId: statementLineId,
    },
  });
  return updated;
}

/** اقتراح مطابقات حسب تساوي المبلغ المطلق وقرب التاريخ (±tolDays). */
export async function suggestBankMatches(statementId: string, tolDays = 3) {
  const stmt = await getBankStatement(statementId);
  const payments = await prisma.treasuryPayment.findMany({
    where: { cashBankId: stmt.cashBankId },
    orderBy: { paymentDate: "desc" },
    take: 500,
  });
  const msPerDay = 86_400_000;
  const suggestions: Array<{ lineId: string; paymentId: string; score: number }> = [];
  for (const line of stmt.lines) {
    if (line.status !== "UNMATCHED") continue;
    for (const p of payments) {
      if (line.amount.abs().minus(p.amount.abs()).abs().gt(EPS)) continue;
      const lineSign = line.amount.gt(0) ? 1 : line.amount.lt(0) ? -1 : 0;
      const paySign = p.direction === "RECEIPT" ? 1 : -1;
      if (lineSign !== 0 && lineSign !== paySign) continue;
      const days = Math.abs(line.txnDate.getTime() - p.paymentDate.getTime()) / msPerDay;
      if (days > tolDays) continue;
      suggestions.push({ lineId: line.id, paymentId: p.id, score: tolDays - days });
    }
  }
  suggestions.sort((a, b) => b.score - a.score);
  return { statementId, suggestions };
}
