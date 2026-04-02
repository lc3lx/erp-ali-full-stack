import { Prisma } from "@prisma/client";
import { AppError } from "../../utils/errors.js";
import type { GlLineInput } from "./types.js";

const EPS = new Prisma.Decimal("0.0001");
const FUNC_CURRENCY = "USD";

export function amt(n: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (n == null) return new Prisma.Decimal(0);
  if (n instanceof Prisma.Decimal) return n;
  return new Prisma.Decimal(String(n));
}

export type BaseLineRow = {
  debitBase: Prisma.Decimal;
  creditBase: Prisma.Decimal;
};

/** تحقق مزدوج القيد في العملة الوظيفية (base) قبل الإدراج */
export function assertBalancedBase(lines: BaseLineRow[], context?: string) {
  let dr = amt(0);
  let cr = amt(0);
  for (const l of lines) {
    dr = dr.add(l.debitBase);
    cr = cr.add(l.creditBase);
  }
  if (dr.minus(cr).abs().gt(EPS)) {
    throw new AppError(
      400,
      `Unbalanced journal in base currency${context ? `: ${context}` : ""} (debit ${dr} ≠ credit ${cr})`,
      "GL_UNBALANCED",
    );
  }
  if (lines.length < 2) {
    throw new AppError(400, "Journal must have at least two lines", "GL_MIN_LINES");
  }
}

export function mapLineToBaseRow(l: GlLineInput, lineNo: number): GlLineInput & BaseLineRow {
  const debit = amt(l.debit ?? 0);
  const credit = amt(l.credit ?? 0);
  if (debit.gt(0) && credit.gt(0)) {
    throw new AppError(400, `Line ${lineNo}: cannot have both debit and credit`, "GL_LINE_INVALID");
  }
  const ex = l.exchangeRate != null ? amt(l.exchangeRate) : amt(1);
  if (ex.lte(0)) throw new AppError(400, "exchangeRate must be positive", "FX_INVALID");
  return {
    ...l,
    debitBase: debit.mul(ex),
    creditBase: credit.mul(ex),
  };
}

export function validateGlLineInputs(lines: GlLineInput[]) {
  const rows = lines.map((l, i) => mapLineToBaseRow(l, i + 1));
  assertBalancedBase(
    rows.map((r) => ({ debitBase: r.debitBase, creditBase: r.creditBase })),
    "engine validation",
  );
}

export type SaleLineForTax = {
  lineSubtotal: Prisma.Decimal | null;
  taxAmount: Prisma.Decimal | null;
  taxRate?: { outputVatAccountId: string | null } | null;
};

/**
 * تجميع ضريبة المخرجات حسب حساب الإخراج (يدعم أكثر من معدّل / حساب)
 */
export function aggregateOutputVatByAccount(lines: SaleLineForTax[]): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const ln of lines) {
    const t = amt(ln.taxAmount);
    if (t.lte(0)) continue;
    const accId = ln.taxRate?.outputVatAccountId;
    if (!accId) continue;
    const cur = map.get(accId) ?? amt(0);
    map.set(accId, cur.add(t));
  }
  return map;
}

export function sumDocTax(lines: SaleLineForTax[]): Prisma.Decimal {
  return lines.reduce((s, l) => s.add(amt(l.taxAmount)), amt(0));
}

/** يدمج مبالغ الضريبة التي لا تحمل TaxRate بحساب افتراضي */
export function buildOutputVatMapFromSaleLines(
  lines: SaleLineForTax[],
  fallbackOutputVatAccountId?: string | null,
): Map<string, Prisma.Decimal> {
  const map = aggregateOutputVatByAccount(lines);
  let orphan = amt(0);
  for (const ln of lines) {
    const t = amt(ln.taxAmount);
    if (t.lte(0)) continue;
    if (!ln.taxRate?.outputVatAccountId) orphan = orphan.add(t);
  }
  if (orphan.gt(0)) {
    if (!fallbackOutputVatAccountId) {
      throw new AppError(
        400,
        "Sale lines have tax but missing TaxRate.outputVatAccountId — set tax rate accounts or pass defaultOutputVatAccountId",
        "VAT_ACCOUNT_MISSING",
      );
    }
    const k = fallbackOutputVatAccountId;
    map.set(k, (map.get(k) ?? amt(0)).add(orphan));
  }
  return map;
}

export type PurchaseLineForTax = {
  taxAmount: Prisma.Decimal | null;
  taxRate?: { inputVatAccountId: string | null } | null;
};

export function buildInputVatMapFromPurchaseLines(
  lines: PurchaseLineForTax[],
  fallbackInputVatAccountId?: string | null,
): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  let orphan = amt(0);
  for (const ln of lines) {
    const t = amt(ln.taxAmount);
    if (t.lte(0)) continue;
    const acc = ln.taxRate?.inputVatAccountId;
    if (acc) {
      map.set(acc, (map.get(acc) ?? amt(0)).add(t));
    } else {
      orphan = orphan.add(t);
    }
  }
  if (orphan.gt(0)) {
    if (!fallbackInputVatAccountId) {
      throw new AppError(
        400,
        "Purchase lines have tax but missing TaxRate.inputVatAccountId — configure tax or pass defaultInputVatAccountId",
        "INPUT_VAT_ACCOUNT_MISSING",
      );
    }
    const k = fallbackInputVatAccountId;
    map.set(k, (map.get(k) ?? amt(0)).add(orphan));
  }
  return map;
}

export type BuildSaleGlParams = {
  description: string;
  customerId: string;
  containerId: string;
  docTotal: Prisma.Decimal;
  exchangeMultiplier: Prisma.Decimal;
  arAccountId: string;
  revenueAccountId: string;
  /**
   * COGS / مخزون — مبالغ جاهزة للترحيل (نفس سلوك النظام السابق: دون تطبيق multiplier على المخزون)
   */
  cogsPair?: { cogsAccountId: string; inventoryAccountId: string; cogsAmount: Prisma.Decimal };
  /** سطور ضريبة مخرجات: accountId → مبلغ بعملة المستند */
  outputVatByAccount?: Map<string, Prisma.Decimal>;
};

/**
 * بناء قيود بيع AR / إيراد / ضريبة / COGS بصيغة مزدوجة القيد.
 * مبلغ الذمم = إجمالي الفاتورة × سعر الصرف؛ الإيراد = الإجمالي − ضريبة (عملة المستند) × سعر الصرف.
 */
export function buildSaleInvoiceGlLines(p: BuildSaleGlParams): GlLineInput[] {
  const docTotal = amt(p.docTotal);
  if (docTotal.lte(0)) throw new AppError(400, "Invoice total must be > 0", "INV_TOTAL_INVALID");

  const postingAmount = docTotal.mul(p.exchangeMultiplier);
  const vatMap = p.outputVatByAccount ?? new Map();
  let postingTax = amt(0);
  for (const [, v] of vatMap) postingTax = postingTax.add(v.mul(p.exchangeMultiplier));

  const postingRevenue = postingAmount.minus(postingTax);
  if (postingRevenue.lt(0)) {
    throw new AppError(400, "Tax exceeds invoice total", "TAX_EXCEEDS_TOTAL");
  }

  const lines: GlLineInput[] = [
    {
      accountId: p.arAccountId,
      debit: postingAmount.toString(),
      credit: "0",
      partyId: p.customerId,
      containerId: p.containerId,
      currency: FUNC_CURRENCY,
      exchangeRate: "1",
      description: p.description,
    },
    {
      accountId: p.revenueAccountId,
      debit: "0",
      credit: postingRevenue.toString(),
      containerId: p.containerId,
      currency: FUNC_CURRENCY,
      exchangeRate: "1",
      description: p.description,
    },
  ];

  for (const [accountId, docTax] of vatMap) {
    const t = amt(docTax).mul(p.exchangeMultiplier);
    if (t.lte(0)) continue;
    lines.push({
      accountId,
      debit: "0",
      credit: t.toString(),
      containerId: p.containerId,
      currency: FUNC_CURRENCY,
      exchangeRate: "1",
      description: `${p.description} — VAT`,
    });
  }

  if (p.cogsPair && amt(p.cogsPair.cogsAmount).gt(0)) {
    const c = amt(p.cogsPair.cogsAmount);
    lines.push(
      {
        accountId: p.cogsPair.cogsAccountId,
        debit: c.toString(),
        credit: "0",
        containerId: p.containerId,
        currency: FUNC_CURRENCY,
        exchangeRate: "1",
        description: `COGS ${p.description}`,
      },
      {
        accountId: p.cogsPair.inventoryAccountId,
        debit: "0",
        credit: c.toString(),
        containerId: p.containerId,
        currency: FUNC_CURRENCY,
        exchangeRate: "1",
        description: `Inventory out ${p.description}`,
      },
    );
  }

  validateGlLineInputs(lines);
  return lines;
}

export type BuildPurchaseGlParams = {
  description: string;
  supplierId: string;
  containerId: string;
  docTotal: Prisma.Decimal;
  exchangeMultiplier: Prisma.Decimal;
  expenseOrInventoryAccountId: string;
  apAccountId: string;
  /** ضريبة مدخلات بعملة المستند */
  inputVatByAccount?: Map<string, Prisma.Decimal>;
};

/** مشتريات: مدين مخزون/مصروف (+ أصل ض.م. قابلة للاسترداد) / دائن الموردين */
export function buildPurchaseInvoiceGlLines(p: BuildPurchaseGlParams): GlLineInput[] {
  const docTotal = amt(p.docTotal);
  if (docTotal.lte(0)) throw new AppError(400, "Purchase total must be > 0", "PINV_TOTAL_INVALID");

  const postingAP = docTotal.mul(p.exchangeMultiplier);
  const inputMap = p.inputVatByAccount ?? new Map();
  let postingInputVat = amt(0);
  for (const [, v] of inputMap) postingInputVat = postingInputVat.add(v.mul(p.exchangeMultiplier));

  const postingNetExpense = postingAP.minus(postingInputVat);
  if (postingNetExpense.lt(0)) throw new AppError(400, "Input VAT exceeds invoice", "INPUT_VAT_INVALID");

  const lines: GlLineInput[] = [
    {
      accountId: p.expenseOrInventoryAccountId,
      debit: postingNetExpense.toString(),
      credit: "0",
      containerId: p.containerId,
      currency: FUNC_CURRENCY,
      exchangeRate: "1",
      description: p.description,
    },
  ];

  for (const [accountId, docVat] of inputMap) {
    const t = amt(docVat).mul(p.exchangeMultiplier);
    if (t.lte(0)) continue;
    lines.push({
      accountId,
      debit: t.toString(),
      credit: "0",
      containerId: p.containerId,
      currency: FUNC_CURRENCY,
      exchangeRate: "1",
      description: `${p.description} — input VAT`,
    });
  }

  lines.push({
    accountId: p.apAccountId,
    debit: "0",
    credit: postingAP.toString(),
    partyId: p.supplierId,
    containerId: p.containerId,
    currency: FUNC_CURRENCY,
    exchangeRate: "1",
    description: p.description,
  });

  validateGlLineInputs(lines);
  return lines;
}
