import { Prisma, type ReconciliationMatchType } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";

const EPS = new Prisma.Decimal("0.0001");

function dec(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

async function assertLineReady(
  tx: Prisma.TransactionClient,
  lineId: string,
): Promise<{ line: Prisma.JournalLineGetPayload<{ include: { journalEntry: true; account: true } }> }> {
  const line = await tx.journalLine.findUnique({
    where: { id: lineId },
    include: { journalEntry: true, account: true },
  });
  if (!line) throw new AppError(404, "Journal line not found");
  if (line.journalEntry.status !== "POSTED" || line.journalEntry.voidedAt) {
    throw new AppError(400, "Only posted, non-voided journal lines can be reconciled");
  }
  if (!line.partyId) throw new AppError(400, "Line must have a party for subledger reconciliation");
  return { line };
}

/** مبلغ غير المطابق بعد على سطر «رجل مدين» (مثل مدين ذمم من فاتورة) */
export async function openDebitLegAmount(
  lineId: string,
  outerTx?: Prisma.TransactionClient,
): Promise<Prisma.Decimal> {
  const run = async (tx: Prisma.TransactionClient) => {
    const { line } = await assertLineReady(tx, lineId);
    const gross = dec(line.debit);
    if (gross.lte(EPS)) return new Prisma.Decimal(0);
    const matched = await tx.reconciliationMatch.aggregate({
      where: { debitJournalLineId: lineId, reversedAt: null },
      _sum: { amount: true },
    });
    return gross.sub(dec(matched._sum.amount));
  };
  if (outerTx) return run(outerTx);
  return prisma.$transaction(run);
}

/** مبلغ غير المطابق بعد على سطر «رجل دائن» (مثل دائن ذمم من قبض) */
export async function openCreditLegAmount(
  lineId: string,
  outerTx?: Prisma.TransactionClient,
): Promise<Prisma.Decimal> {
  const run = async (tx: Prisma.TransactionClient) => {
    const { line } = await assertLineReady(tx, lineId);
    const gross = dec(line.credit);
    if (gross.lte(EPS)) return new Prisma.Decimal(0);
    const matched = await tx.reconciliationMatch.aggregate({
      where: { creditJournalLineId: lineId, reversedAt: null },
      _sum: { amount: true },
    });
    return gross.sub(dec(matched._sum.amount));
  };
  if (outerTx) return run(outerTx);
  return prisma.$transaction(run);
}

export async function createReconciliationMatch(input: {
  debitJournalLineId: string;
  creditJournalLineId: string;
  amount: number | string | Prisma.Decimal;
  matchType?: ReconciliationMatchType;
  note?: string | null;
  companyId?: string | null;
  userId?: string;
}) {
  const amount = dec(input.amount);
  if (amount.lte(EPS)) throw new AppError(400, "Match amount must be positive");

  return prisma.$transaction(async (tx) => {
    const openDr = await openDebitLegAmount(input.debitJournalLineId, tx);
    const openCr = await openCreditLegAmount(input.creditJournalLineId, tx);
    if (amount.gt(openDr) || amount.gt(openCr)) {
      throw new AppError(400, "Match exceeds open amount on debit or credit leg (over-reconciliation)");
    }

    const drCtx = await assertLineReady(tx, input.debitJournalLineId);
    const crCtx = await assertLineReady(tx, input.creditJournalLineId);
    if (drCtx.line.partyId !== crCtx.line.partyId) {
      throw new AppError(400, "Debit and credit legs must belong to the same party");
    }
    if (drCtx.line.currency !== crCtx.line.currency) {
      throw new AppError(400, "Line currencies must match");
    }
    const matchType = input.matchType ?? "STANDARD";
    if (matchType === "STANDARD" && drCtx.line.accountId !== crCtx.line.accountId) {
      throw new AppError(400, "Standard reconciliation requires the same GL account on both lines");
    }
    if (input.companyId) {
      const drCo = drCtx.line.journalEntry.companyId;
      const crCo = crCtx.line.journalEntry.companyId;
      if (drCo && drCo !== input.companyId) throw new AppError(400, "Debit line company mismatch");
      if (crCo && crCo !== input.companyId) throw new AppError(400, "Credit line company mismatch");
    }

    const m = await tx.reconciliationMatch.create({
      data: {
        debitJournalLineId: input.debitJournalLineId,
        creditJournalLineId: input.creditJournalLineId,
        amount,
        matchType,
        note: input.note?.trim() || null,
        companyId: input.companyId ?? drCtx.line.journalEntry.companyId ?? crCtx.line.journalEntry.companyId,
        createdById: input.userId ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: "RECONCILIATION_MATCH",
        entityType: "ReconciliationMatch",
        entityId: m.id,
        details: {
          debitJournalLineId: m.debitJournalLineId,
          creditJournalLineId: m.creditJournalLineId,
          amount: m.amount.toString(),
          matchType: m.matchType,
        } as Prisma.InputJsonValue,
      },
    });
    return m;
  });
}

export async function reverseReconciliationMatch(matchId: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    const m = await tx.reconciliationMatch.findUnique({ where: { id: matchId } });
    if (!m) throw new AppError(404, "Reconciliation match not found");
    if (m.reversedAt) throw new AppError(400, "Match already reversed");
    const updated = await tx.reconciliationMatch.update({
      where: { id: matchId },
      data: { reversedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "RECONCILIATION_MATCH_REVERSE",
        entityType: "ReconciliationMatch",
        entityId: matchId,
        details: { amount: m.amount.toString() } as Prisma.InputJsonValue,
      },
    });
    return updated;
  });
}

export async function listReconciliationMatches(filters: { partyId?: string; companyId?: string | null }) {
  const where: Prisma.ReconciliationMatchWhereInput = {
    reversedAt: null,
    ...(filters.companyId !== undefined && filters.companyId !== null ? { companyId: filters.companyId } : {}),
  };
  if (filters.partyId) {
    where.AND = [
      { debitLine: { partyId: filters.partyId } },
      { creditLine: { partyId: filters.partyId } },
    ];
  }
  return prisma.reconciliationMatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      debitLine: { include: { account: true, journalEntry: true } },
      creditLine: { include: { account: true, journalEntry: true } },
    },
  });
}

/** أسطر دفتر منشورة مع «رصيد مفتوح قابل للمطابقة» لتسوية AR/AP (تعدد فواتير/سندات). */
export async function listOpenReconciliationLines(filters: {
  partyId: string;
  accountId?: string;
  companyId?: string | null;
}) {
  const jeFilter: Prisma.JournalEntryWhereInput = {
    status: "POSTED",
    voidedAt: null,
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
  };
  const lines = await prisma.journalLine.findMany({
    where: {
      partyId: filters.partyId,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      journalEntry: jeFilter,
      OR: [{ debit: { gt: 0 } }, { credit: { gt: 0 } }],
    },
    include: { account: true, journalEntry: true },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { lineNo: "asc" }],
  });

  const result: Array<{
    line: (typeof lines)[0];
    role: "DEBIT_LEG" | "CREDIT_LEG";
    openAmount: string;
  }> = [];

  for (const line of lines) {
    if (dec(line.debit).gt(EPS)) {
      const open = await openDebitLegAmount(line.id);
      if (open.gt(EPS)) result.push({ line, role: "DEBIT_LEG", openAmount: open.toFixed(4) });
    } else if (dec(line.credit).gt(EPS)) {
      const open = await openCreditLegAmount(line.id);
      if (open.gt(EPS)) result.push({ line, role: "CREDIT_LEG", openAmount: open.toFixed(4) });
    }
  }
  return result;
}
