import { randomUUID } from "node:crypto";
import { Prisma, type GlAccountClass } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { createPostedJournal } from "./financeService.js";

const EPS = new Prisma.Decimal("0.0001");
const FUNC = "USD";

function dec(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

export type FxExposureRow = {
  partyId: string;
  accountId: string;
  accountCode: string;
  accountClass: GlAccountClass;
  currency: string;
  /** صافي المعاملات بالعملة الأجنبية: مدين − دائن */
  origNet: string;
  /** رصيد مرحّل بالعملة الوظيفية */
  baseNet: string;
  /** سعر الإغلاق الممرر (وحدات العملة الوظيفية لكل 1 وحدة أجنبية) */
  rate: string;
  /** الرصيد المتوقع بالوظيفي = origNet × rate */
  expectedBase: string;
  /** تعديل محاسبي مطلوب = expectedBase − baseNet */
  adjustment: string;
};

/**
 * تجميع أسطر دفتر منشورة على ذمم بعملة ≠ الوظيفي لحساب تأثير إعادة التقييم.
 * rateByCurrency: مفتاح ISO للعملة → سعر (كم من العملة الوظيفية لكل 1 وحدة أجنبية).
 */
export async function previewFxRevaluation(input: {
  functionalCurrency?: string;
  rateByCurrency: Record<string, string | number | Prisma.Decimal>;
  companyId?: string | null;
}): Promise<FxExposureRow[]> {
  const functional = (input.functionalCurrency ?? FUNC).trim().toUpperCase();
  const rateMap = new Map<string, Prisma.Decimal>();
  for (const [k, v] of Object.entries(input.rateByCurrency)) {
    rateMap.set(k.trim().toUpperCase(), dec(v));
  }

  const jeWhere: Prisma.JournalEntryWhereInput = {
    status: "POSTED",
    voidedAt: null,
    ...(input.companyId ? { companyId: input.companyId } : {}),
  };

  const lines = await prisma.journalLine.findMany({
    where: {
      partyId: { not: null },
      currency: { not: functional },
      journalEntry: jeWhere,
    },
    include: { account: true },
  });

  type Key = string;
  const buckets = new Map<
    Key,
    {
      partyId: string;
      accountId: string;
      accountCode: string;
      accountClass: GlAccountClass;
      currency: string;
      origNet: Prisma.Decimal;
      baseNet: Prisma.Decimal;
    }
  >();

  for (const jl of lines) {
    if (!jl.partyId) continue;
    const key = `${jl.partyId}|${jl.accountId}|${jl.currency}`;
    const origDelta = dec(jl.debit).sub(dec(jl.credit));
    const baseDelta = dec(jl.debitBase).sub(dec(jl.creditBase));
    const cur = buckets.get(key);
    if (!cur) {
      buckets.set(key, {
        partyId: jl.partyId,
        accountId: jl.accountId,
        accountCode: jl.account.code,
        accountClass: jl.account.class,
        currency: jl.currency,
        origNet: origDelta,
        baseNet: baseDelta,
      });
    } else {
      cur.origNet = cur.origNet.add(origDelta);
      cur.baseNet = cur.baseNet.add(baseDelta);
    }
  }

  const out: FxExposureRow[] = [];
  for (const b of buckets.values()) {
    if (b.origNet.abs().lte(EPS) && b.baseNet.abs().lte(EPS)) continue;
    const rate = rateMap.get(b.currency.toUpperCase());
    if (!rate || rate.lte(0)) continue;
    const expectedBase = b.origNet.mul(rate);
    const adjustment = expectedBase.sub(b.baseNet);
    if (adjustment.abs().lte(EPS)) continue;

    const relevantClass = b.accountClass === "ASSET" || b.accountClass === "LIABILITY";
    if (!relevantClass) continue;

    out.push({
      partyId: b.partyId,
      accountId: b.accountId,
      accountCode: b.accountCode,
      accountClass: b.accountClass,
      currency: b.currency,
      origNet: b.origNet.toFixed(4),
      baseNet: b.baseNet.toFixed(4),
      rate: rate.toFixed(8),
      expectedBase: expectedBase.toFixed(4),
      adjustment: adjustment.toFixed(4),
    });
  }
  return out;
}

function buildRevaluationLines(
  rows: FxExposureRow[],
  fxGainAccountId: string,
  fxLossAccountId: string,
): { accountId: string; partyId?: string | null; currency: string; description?: string; debit?: string; credit?: string }[] {
  const lines: {
    accountId: string;
    partyId?: string | null;
    currency: string;
    description?: string;
    debit?: string;
    credit?: string;
  }[] = [];

  for (const r of rows) {
    const adj = dec(r.adjustment);
    if (adj.abs().lte(EPS)) continue;
    const desc = `FX reval ${r.accountCode} ${r.currency}`;

    if (r.accountClass === "ASSET") {
      if (adj.gt(0)) {
        lines.push({ accountId: r.accountId, partyId: r.partyId, currency: FUNC, description: desc, debit: adj.toFixed(4) });
        lines.push({
          accountId: fxGainAccountId,
          partyId: null,
          currency: FUNC,
          description: desc,
          credit: adj.toFixed(4),
        });
      } else {
        const x = adj.abs();
        lines.push({
          accountId: fxLossAccountId,
          partyId: null,
          currency: FUNC,
          description: desc,
          debit: x.toFixed(4),
        });
        lines.push({ accountId: r.accountId, partyId: r.partyId, currency: FUNC, description: desc, credit: x.toFixed(4) });
      }
    } else {
      // LIABILITY
      if (adj.gt(0)) {
        lines.push({
          accountId: fxLossAccountId,
          partyId: null,
          currency: FUNC,
          description: desc,
          debit: adj.toFixed(4),
        });
        lines.push({
          accountId: r.accountId,
          partyId: r.partyId,
          currency: FUNC,
          description: desc,
          credit: adj.toFixed(4),
        });
      } else {
        const x = adj.abs();
        lines.push({ accountId: r.accountId, partyId: r.partyId, currency: FUNC, description: desc, debit: x.toFixed(4) });
        lines.push({
          accountId: fxGainAccountId,
          partyId: null,
          currency: FUNC,
          description: desc,
          credit: x.toFixed(4),
        });
      }
    }
  }
  return lines;
}

export async function postFxRevaluationJournal(input: {
  entryDate: Date;
  functionalCurrency?: string;
  rateByCurrency: Record<string, string | number | Prisma.Decimal>;
  fxGainAccountId: string;
  fxLossAccountId: string;
  description?: string;
  companyId?: string | null;
  userId?: string;
  sourceId?: string;
}) {
  const rows = await previewFxRevaluation({
    functionalCurrency: input.functionalCurrency,
    rateByCurrency: input.rateByCurrency,
    companyId: input.companyId,
  });
  if (!rows.length) throw new AppError(400, "No FX revaluation adjustments computed for given rates");

  const lines = buildRevaluationLines(rows, input.fxGainAccountId, input.fxLossAccountId);
  if (lines.length < 2) throw new AppError(400, "No balanced FX lines generated");

  const je = await createPostedJournal({
    entryDate: input.entryDate,
    description: input.description ?? "FX revaluation (period-end)",
    sourceType: "FX_REVALUATION",
    sourceId: input.sourceId ?? randomUUID(),
    lines,
    userId: input.userId,
    companyId: input.companyId,
  });
  return { journalEntry: je, rowsPreviewed: rows };
}
