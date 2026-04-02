import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";

function d(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(String(v));
}

/** احتساب الضريبة لسطر: المبلغ الصافي قبل الضريبة، نسبة مئوية، شامل أم لا */
export function calculateVatForLine(params: {
  lineNet: Prisma.Decimal | number | string;
  ratePercent: Prisma.Decimal | number | string;
  isInclusive: boolean;
}): { net: Prisma.Decimal; tax: Prisma.Decimal; gross: Prisma.Decimal } {
  const rate = d(params.ratePercent).div(100);
  if (params.isInclusive) {
    const gross = d(params.lineNet);
    const net = gross.div(d(1).add(rate));
    const tax = gross.sub(net);
    return { net, tax, gross };
  }
  const net = d(params.lineNet);
  const tax = net.mul(rate);
  const gross = net.add(tax);
  return { net, tax, gross };
}

export async function getTaxRateOrThrow(taxRateId: string) {
  const t = await prisma.taxRate.findUnique({ where: { id: taxRateId } });
  if (!t || !t.isActive) throw new AppError(404, "Tax rate not found", "TAX_RATE_NOT_FOUND");
  return t;
}

/**
 * تقرير ضريبة المخرجات / المدخلات حسب فترة (تواريخ قيد GL مُرحَّل)
 * يعتمد على taxAmount المخزّن على أسطر الفواتير المرتبطة بقيد POSTED.
 */
export async function vatOutputReport(from: Date, to: Date) {
  const saleLines = await prisma.saleVoucherLine.findMany({
    where: {
      taxAmount: { gt: 0 },
      voucher: {
        glJournalEntryId: { not: null },
        voucherDate: { gte: from, lte: to },
      },
    },
    include: {
      taxRate: { select: { id: true, code: true, name: true, outputVatAccountId: true } },
      voucher: { select: { id: true, voucherNo: true, voucherDate: true, currency: true } },
    },
  });

  const byRate = new Map<string, Prisma.Decimal>();
  let total = d(0);
  for (const ln of saleLines) {
    const ta = d(ln.taxAmount);
    total = total.add(ta);
    const key = ln.taxRateId ?? "unknown";
    byRate.set(key, (byRate.get(key) ?? d(0)).add(ta));
  }

  return {
    kind: "OUTPUT" as const,
    from,
    to,
    totalTax: total,
    lineCount: saleLines.length,
    byTaxRateId: Object.fromEntries([...byRate.entries()].map(([k, v]) => [k, v.toString()])),
    lines: saleLines.map((l) => ({
      voucherId: l.voucherId,
      voucherNo: l.voucher.voucherNo,
      taxRateCode: l.taxRate?.code ?? null,
      taxAmount: l.taxAmount?.toString() ?? "0",
    })),
  };
}

export async function vatInputReport(from: Date, to: Date) {
  const purchaseLines = await prisma.purchaseVoucherLine.findMany({
    where: {
      taxAmount: { gt: 0 },
      voucher: {
        glJournalEntryId: { not: null },
        voucherDate: { gte: from, lte: to },
      },
    },
    include: {
      taxRate: { select: { id: true, code: true, name: true, inputVatAccountId: true } },
      voucher: { select: { id: true, voucherNo: true, voucherDate: true, currency: true } },
    },
  });

  const byRate = new Map<string, Prisma.Decimal>();
  let total = d(0);
  for (const ln of purchaseLines) {
    const ta = d(ln.taxAmount);
    total = total.add(ta);
    const key = ln.taxRateId ?? "unknown";
    byRate.set(key, (byRate.get(key) ?? d(0)).add(ta));
  }

  return {
    kind: "INPUT" as const,
    from,
    to,
    totalTax: total,
    lineCount: purchaseLines.length,
    byTaxRateId: Object.fromEntries([...byRate.entries()].map(([k, v]) => [k, v.toString()])),
    lines: purchaseLines.map((l) => ({
      voucherId: l.voucherId,
      voucherNo: l.voucher.voucherNo,
      taxRateCode: l.taxRate?.code ?? null,
      taxAmount: l.taxAmount?.toString() ?? "0",
    })),
  };
}

/** صافي مستحق الضريبة (مخرجات − مدخلات) — نفس فترة التقارير */
export async function vatPayableSummary(from: Date, to: Date) {
  const [out, inn] = await Promise.all([vatOutputReport(from, to), vatInputReport(from, to)]);
  const payable = d(out.totalTax).sub(d(inn.totalTax));
  return {
    from,
    to,
    outputVat: out.totalTax.toString(),
    inputVat: inn.totalTax.toString(),
    netVatPayable: payable.toString(),
  };
}
