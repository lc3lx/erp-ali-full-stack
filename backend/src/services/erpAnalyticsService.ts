import { type GlAccountClass, Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";

function d(v: Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

/** كشف حساب للطرف — كل حركات دفتر الأستاذ المرتبطة بالطرف */
export async function statementOfAccount(partyId: string, from: Date, to: Date) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) throw new AppError(404, "Party not found");

  const openingAgg = await prisma.journalLine.aggregate({
    where: {
      partyId,
      journalEntry: { status: "POSTED", entryDate: { lt: from } },
    },
    _sum: { debitBase: true, creditBase: true },
  });

  let running = d(openingAgg._sum.debitBase).minus(d(openingAgg._sum.creditBase));
  const lines = await prisma.journalLine.findMany({
    where: {
      partyId,
      journalEntry: { status: "POSTED", entryDate: { gte: from, lte: to } },
    },
    include: {
      account: { select: { code: true, name: true } },
      journalEntry: { select: { id: true, entryNo: true, entryDate: true, description: true } },
    },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { lineNo: "asc" }],
  });

  const rows = lines.map((l) => {
    const dr = d(l.debitBase);
    const cr = d(l.creditBase);
    running = running.add(dr).minus(cr);
    return {
      entryNo: l.journalEntry.entryNo,
      entryDate: l.journalEntry.entryDate,
      accountCode: l.account.code,
      accountName: l.account.name,
      description: l.description ?? l.journalEntry.description,
      debit: dr.toFixed(4),
      credit: cr.toFixed(4),
      balance: running.toFixed(4),
    };
  });

  return {
    party: { id: party.id, name: party.name, type: party.type },
    from: from.toISOString(),
    to: to.toISOString(),
    openingBalance: d(openingAgg._sum.debitBase).minus(d(openingAgg._sum.creditBase)).toFixed(4),
    rows,
    closingBalance: running.toFixed(4),
  };
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

/** أعمار الذمم من دفتر الأستاذ مباشرة (party journal lines) */
export async function agingReport(partyId: string, asOf: Date) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) throw new AppError(404, "Party not found");

  const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b90p: 0 };
  const lines = await prisma.journalLine.findMany({
    where: {
      partyId,
      journalEntry: { status: "POSTED", entryDate: { lte: asOf } },
    },
    include: { journalEntry: { select: { entryNo: true, entryDate: true } } },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { lineNo: "asc" }],
  });

  const rows: { docNo: string; due: string; ageDays: number; remaining: number; bucket: string }[] = [];
  for (const l of lines) {
    const rem =
      party.type === "CUSTOMER"
        ? d(l.debitBase).minus(d(l.creditBase)).toNumber()
        : d(l.creditBase).minus(d(l.debitBase)).toNumber();
    if (rem <= 0.0001) continue;
    const base = l.journalEntry.entryDate;
    const age = daysBetween(asOf, base);
    let b = "90+";
    if (age <= 30) {
      buckets.b0_30 += rem;
      b = "0-30";
    } else if (age <= 60) {
      buckets.b31_60 += rem;
      b = "31-60";
    } else if (age <= 90) {
      buckets.b61_90 += rem;
      b = "61-90";
    } else buckets.b90p += rem;
    rows.push({
      docNo: l.journalEntry.entryNo,
      due: base.toISOString(),
      ageDays: age,
      remaining: rem,
      bucket: b,
    });
  }
  return { party: { id: party.id, name: party.name, type: party.type }, asOf: asOf.toISOString(), buckets, rows };
}

/** ربحية الحاوية — إيرادات، تكلفة مشتريات، مصاريف تكاليف */
export async function containerProfitability(containerId: string) {
  const c = await prisma.container.findUnique({
    where: { id: containerId },
    include: { costLines: true },
  });
  if (!c) throw new AppError(404, "Container not found");
  const [sales, purchases] = await Promise.all([
    prisma.saleVoucher.aggregate({
      where: { containerId },
      _sum: { total: true, profit: true },
    }),
    prisma.purchaseInvoiceVoucher.aggregate({
      where: { containerId },
      _sum: { summation: true },
    }),
  ]);
  const extraCosts = c.costLines.reduce((s, x) => s + Number(x.amount), 0);
  const revenue = Number(sales._sum.total ?? 0);
  const purchaseCost = Number(purchases._sum.summation ?? 0);
  const gross = revenue - purchaseCost;
  const net = revenue - purchaseCost - extraCosts;
  return {
    container: { id: c.id, containerNo: c.containerNo, status: c.status },
    revenue,
    purchaseCost,
    containerExtraCosts: extraCosts,
    grossContribution: gross,
    estimatedNet: net,
  };
}

/** قائمة دخل مبسطة حسب فئات الحساب */
export async function incomeStatement(from: Date, to: Date) {
  const lines = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: { status: "POSTED", entryDate: { gte: from, lte: to } },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const accounts = await prisma.glAccount.findMany({
    where: { id: { in: lines.map((l) => l.accountId) } },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let revenue = 0;
  let expense = 0;
  const detail: { code: string; name: string; class: GlAccountClass; net: number }[] = [];
  for (const row of lines) {
    const a = byId.get(row.accountId);
    if (!a) continue;
    const dr = d(row._sum.debitBase).toNumber();
    const cr = d(row._sum.creditBase).toNumber();
    let net = 0;
    if (a.class === "REVENUE") net = cr - dr;
    else if (a.class === "EXPENSE") net = dr - cr;
    else continue;
    detail.push({ code: a.code, name: a.name, class: a.class, net });
    if (a.class === "REVENUE") revenue += net;
    if (a.class === "EXPENSE") expense += net;
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalRevenue: revenue,
    totalExpense: expense,
    netIncome: revenue - expense,
    lines: detail.sort((x, y) => x.code.localeCompare(y.code)),
  };
}

/** ميزانية عمومية مبسطة (أصول، خصوم، حقوق ملكية) من أرصدة الفترة */
export async function balanceSheet(asOf: Date) {
  const lines = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: { status: "POSTED", entryDate: { lte: asOf } },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const accounts = await prisma.glAccount.findMany({
    where: { id: { in: lines.map((l) => l.accountId) } },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const assets: { code: string; name: string; balance: number }[] = [];
  const liabilities: { code: string; name: string; balance: number }[] = [];
  const equity: { code: string; name: string; balance: number }[] = [];
  let totalAssets = 0;
  let totalLiab = 0;
  let totalEq = 0;
  for (const row of lines) {
    const a = byId.get(row.accountId);
    if (!a) continue;
    if (!["ASSET", "LIABILITY", "EQUITY"].includes(a.class)) continue;
    const bal = d(row._sum.debitBase).minus(d(row._sum.creditBase)).toNumber();
    const entry = { code: a.code, name: a.name, balance: Math.abs(bal) };
    if (a.class === "ASSET") {
      const signed = bal;
      assets.push({ ...entry, balance: signed });
      totalAssets += signed;
    } else if (a.class === "LIABILITY") {
      const signed = -bal;
      liabilities.push({ ...entry, balance: signed });
      totalLiab += signed;
    } else {
      const signed = -bal;
      equity.push({ ...entry, balance: signed });
      totalEq += signed;
    }
  }
  return {
    asOf: asOf.toISOString(),
    assets,
    liabilities,
    equity,
    totals: { assets: totalAssets, liabilities: totalLiab, equity: totalEq },
  };
}

/** تدفقات نقدية مبسطة — صافي حركة حسابات الأصول النقدية */
export async function cashFlowApprox(from: Date, to: Date) {
  const cashAccounts = await prisma.glAccount.findMany({
    where: { class: "ASSET", code: { startsWith: "1" } },
    take: 30,
  });
  const ids = cashAccounts.map((a) => a.id);
  if (!ids.length) {
    return { from: from.toISOString(), to: to.toISOString(), netChange: 0, rows: [] as { account: string; net: number }[] };
  }
  const lines = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: ids },
      journalEntry: { status: "POSTED", entryDate: { gte: from, lte: to } },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  let net = 0;
  const rows: { account: string; net: number }[] = [];
  const byCode = new Map(cashAccounts.map((a) => [a.id, a]));
  for (const row of lines) {
    const a = byCode.get(row.accountId);
    if (!a) continue;
    const n = d(row._sum.debitBase).minus(d(row._sum.creditBase)).toNumber();
    rows.push({ account: `${a.code} ${a.name}`, net: n });
    net += n;
  }
  return { from: from.toISOString(), to: to.toISOString(), netChange: net, rows };
}

export async function dashboardKpis() {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [containersActive, salesMonth, purchasesMonth, topBalances, containerStatusCounts, sales6m, purchases6m] = await Promise.all([
    prisma.container.count({ where: { status: { not: "CLOSED" } } }),
    prisma.saleVoucher.aggregate({
      where: { voucherDate: { gte: startMonth } },
      _sum: { total: true },
    }),
    prisma.purchaseInvoiceVoucher.aggregate({
      where: { voucherDate: { gte: startMonth } },
      _sum: { summation: true },
    }),
    prisma.invStockBalance.findMany({
      take: 5,
      orderBy: { qtyOnHand: "desc" },
      include: { item: { select: { name: true } }, warehouse: { select: { name: true } } },
    }),
    prisma.container.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.saleVoucher.findMany({
      where: { voucherDate: { gte: sixMonthsAgo } },
      select: { voucherDate: true, total: true },
    }),
    prisma.purchaseInvoiceVoucher.findMany({
      where: { voucherDate: { gte: sixMonthsAgo } },
      select: { voucherDate: true, summation: true },
    }),
  ]);
  const monthlySalesMap = new Map<string, number>();
  const monthlyPurchasesMap = new Map<string, number>();
  for (let i = 0; i < 6; i += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    monthlySalesMap.set(key, 0);
    monthlyPurchasesMap.set(key, 0);
  }
  for (const row of sales6m) {
    if (!row.voucherDate) continue;
    const key = `${row.voucherDate.getFullYear()}-${String(row.voucherDate.getMonth() + 1).padStart(2, "0")}`;
    monthlySalesMap.set(key, (monthlySalesMap.get(key) ?? 0) + Number(row.total ?? 0));
  }
  for (const row of purchases6m) {
    if (!row.voucherDate) continue;
    const key = `${row.voucherDate.getFullYear()}-${String(row.voucherDate.getMonth() + 1).padStart(2, "0")}`;
    monthlyPurchasesMap.set(key, (monthlyPurchasesMap.get(key) ?? 0) + Number(row.summation ?? 0));
  }
  const monthlySales = [...monthlySalesMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month, total }));
  const monthlyPurchases = [...monthlyPurchasesMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month, total }));
  const monthlyNet = monthlySales.map((s) => {
    const p = monthlyPurchases.find((x) => x.month === s.month)?.total ?? 0;
    return { month: s.month, total: s.total - p };
  });
  const lastIdx = monthlySales.length - 1;
  const prevIdx = monthlySales.length - 2;
  const salesMoM =
    prevIdx >= 0 && monthlySales[prevIdx].total !== 0
      ? ((monthlySales[lastIdx].total - monthlySales[prevIdx].total) / monthlySales[prevIdx].total) * 100
      : 0;
  const purchasesMoM =
    prevIdx >= 0 && monthlyPurchases[prevIdx].total !== 0
      ? ((monthlyPurchases[lastIdx].total - monthlyPurchases[prevIdx].total) / monthlyPurchases[prevIdx].total) * 100
      : 0;
  return {
    activeContainers: containersActive,
    monthSalesTotal: Number(salesMonth._sum.total ?? 0),
    monthPurchasesTotal: Number(purchasesMonth._sum.summation ?? 0),
    topStock: topBalances.map((b) => ({
      item: b.item.name,
      warehouse: b.warehouse.name,
      qty: b.qtyOnHand.toString(),
    })),
    containersByStatus: containerStatusCounts.map((r) => ({ status: r.status, count: r._count.status })),
    monthlySales,
    monthlyPurchases,
    monthlyNet,
    salesMoM,
    purchasesMoM,
  };
}
