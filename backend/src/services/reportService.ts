import type { ContainerStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";

export type ReportTab =
  | "cust"
  | "item"
  | "mat-inv"
  | "all-moves"
  | "cont-inv"
  | "cont-sale";

export async function runReport(
  tab: ReportTab,
  filters: {
    status?: ContainerStatus | "all";
    containerNo?: string;
    dateFrom?: string;
    dateTo?: string;
    receivingCompany?: string;
    fromNo?: string;
    toNo?: string;
    releaseExport?: boolean;
  },
) {
  switch (tab) {
    case "cont-inv":
      return containerInventoryReport(filters);
    case "cont-sale":
      return containersInSaleReport(filters);
    case "cust":
      return customerSupplierMovementReport(filters);
    case "item":
      return itemMovementReport(filters);
    case "mat-inv":
      return materialInventoryReport(filters);
    case "all-moves":
      return allMaterialsMovesReport(filters);
    default:
      return containerInventoryReport(filters);
  }
}

async function containerWhere(
  filters: {
    status?: ContainerStatus | "all";
    containerNo?: string;
    dateFrom?: string;
    dateTo?: string;
    receivingCompany?: string;
    releaseExport?: boolean;
    fromNo?: string;
    toNo?: string;
  },
): Promise<Prisma.ContainerWhereInput> {
  const where: Prisma.ContainerWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status;

  const q = filters.containerNo?.trim();
  const from = filters.fromNo?.trim();
  const to = filters.toNo?.trim();
  const hasContains = Boolean(q);
  const hasRange = Boolean(from || to);
  const range: Prisma.StringFilter = {};
  if (from) range.gte = from;
  if (to) range.lte = to;

  if (hasContains && hasRange) {
    where.AND = [
      { containerNo: { contains: q!, mode: "insensitive" } },
      { containerNo: range },
    ];
  } else if (hasContains) {
    where.containerNo = { contains: q!, mode: "insensitive" };
  } else if (hasRange) {
    where.containerNo = range;
  }
  if (filters.receivingCompany) {
    where.receiverName = { contains: filters.receivingCompany, mode: "insensitive" };
  }
  if (filters.releaseExport === true) {
    where.releaseExportFlag = true;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.arriveDate = {};
    if (filters.dateFrom) {
      const d = new Date(filters.dateFrom);
      if (!Number.isNaN(d.getTime())) where.arriveDate.gte = d;
    }
    if (filters.dateTo) {
      const d = new Date(filters.dateTo);
      if (!Number.isNaN(d.getTime())) where.arriveDate.lte = d;
    }
  }
  return where;
}

async function containerInventoryReport(filters: Parameters<typeof containerWhere>[0]) {
  const where = await containerWhere(filters);
  const rows = await prisma.container.findMany({
    where,
    orderBy: { containerNo: "asc" },
    include: { clearanceCompany: true },
  });
  const mapped = rows.map((r, idx) => ({
    id: idx + 1,
    policyNo: r.policyNo ?? "",
    containerNo: r.containerNo,
    received: r.received,
    shipDate: r.shipDate,
    arrivalDate: r.arriveDate,
    release: r.release ?? "",
    country: r.country ?? r.sourceCountry ?? "",
    axis: r.axis ?? r.centralPoint ?? "",
    receiver: r.receiverName ?? "",
    receiverNo: r.receiverPhone ?? "",
    cartons: r.cartonsTotal,
    weight: r.weightTotal != null ? Number(r.weightTotal) : null,
    contents: r.contents ?? "",
    clearanceCo: r.clearanceCompany?.name ?? "",
    profit: r.profit != null ? Number(r.profit) : 0,
    selected: false,
  }));
  const totalProfit = mapped.reduce((s, r) => s + (r.profit || 0), 0);
  return {
    tab: "cont-inv" as const,
    rows: mapped,
    meta: { containerCount: mapped.length, totalProfit },
  };
}

async function containersInSaleReport(filters: Parameters<typeof containerWhere>[0]) {
  const where = await containerWhere(filters);
  const saleContainers = await prisma.saleVoucher.findMany({
    distinct: ["containerId"],
    select: { containerId: true },
  });
  const validIds = saleContainers.map((s) => s.containerId).filter((id): id is string => id !== null);
  const ids = new Set(validIds);
  const rowsRaw = await prisma.container.findMany({
    where: { ...where, id: { in: [...ids] } },
    include: { clearanceCompany: true },
    orderBy: { containerNo: "asc" },
  });
  const mapped = rowsRaw.map((r, idx) => ({
    id: idx + 1,
    policyNo: r.policyNo ?? "",
    containerNo: r.containerNo,
    received: r.received,
    shipDate: r.shipDate,
    arrivalDate: r.arriveDate,
    release: r.release ?? "",
    country: r.country ?? r.sourceCountry ?? "",
    axis: r.axis ?? r.centralPoint ?? "",
    receiver: r.receiverName ?? "",
    receiverNo: r.receiverPhone ?? "",
    cartons: r.cartonsTotal,
    weight: r.weightTotal != null ? Number(r.weightTotal) : null,
    contents: r.contents ?? "",
    clearanceCo: r.clearanceCompany?.name ?? "",
    profit: r.profit != null ? Number(r.profit) : 0,
    selected: false,
  }));
  const totalProfit = mapped.reduce((s, r) => s + (r.profit || 0), 0);
  return { tab: "cont-sale" as const, rows: mapped, meta: { containerCount: mapped.length, totalProfit } };
}

type ReportRow = Awaited<ReturnType<typeof containerInventoryReport>>["rows"][number];

async function customerSupplierMovementReport(_filters: Record<string, unknown>) {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" }, take: 500 });
  const rows: ReportRow[] = [];
  let idx = 0;
  for (const p of parties) {
    const [aggP, aggS] = await Promise.all([
      prisma.purchaseInvoiceVoucher.aggregate({
        where: { supplierId: p.id },
        _sum: { summation: true },
        _count: true,
      }),
      prisma.saleVoucher.aggregate({
        where: { customerId: p.id },
        _sum: { total: true },
        _count: true,
      }),
    ]);
    const purchaseTotal = Number(aggP._sum.summation ?? 0);
    const saleTotal = Number(aggS._sum.total ?? 0);
    if (aggP._count === 0 && aggS._count === 0) continue;
    idx += 1;
    rows.push({
      id: idx,
      policyNo: p.type,
      containerNo: p.name,
      received: false,
      shipDate: null,
      arrivalDate: null,
      release: "",
      country: "",
      axis: p.phone ?? "",
      receiver: "",
      receiverNo: "",
      cartons: aggP._count + aggS._count,
      weight: null,
      contents: `مشتريات ${purchaseTotal.toFixed(2)} | مبيعات ${saleTotal.toFixed(2)}`,
      clearanceCo: p.address ?? "",
      profit: saleTotal - purchaseTotal,
      selected: false,
    });
  }
  const totalProfit = rows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  return {
    tab: "cust" as const,
    rows,
    meta: { totalProfit, containerCount: rows.length },
  };
}

async function itemMovementReport(_filters: Record<string, unknown>) {
  const fromContainers = await prisma.containerLineItem.groupBy({
    by: ["itemNo", "itemName"],
    where: { OR: [{ itemNo: { not: null } }, { itemName: { not: null } }] },
    _count: true,
    _sum: { boxes: true, pieces: true, weight: true, cbm: true },
  });
  let idx = 0;
  const rows: ReportRow[] = fromContainers.map((g) => {
    idx += 1;
 const label = [g.itemNo, g.itemName].filter(Boolean).join(" — ") || "—";
    return {
      id: idx,
      policyNo: "ITEM",
      containerNo: label.slice(0, 60),
      received: false,
      shipDate: null,
      arrivalDate: null,
      release: "",
      country: "",
      axis: "",
      receiver: "",
      receiverNo: "",
      cartons: g._count,
      weight: g._sum.weight != null ? Number(g._sum.weight) : null,
      contents: `صناديق ${g._sum.boxes ?? 0} | قطع ${Number(g._sum.pieces ?? 0)} | cbm ${Number(g._sum.cbm ?? 0)}`,
      clearanceCo: "",
      profit: 0,
      selected: false,
    };
  });
  const totalProfit = rows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  return { tab: "item" as const, rows, meta: { totalProfit, containerCount: rows.length } };
}

async function materialInventoryReport(_filters: Record<string, unknown>) {
  const fromContainers = await prisma.containerLineItem.groupBy({
    by: ["itemName"],
    where: { itemName: { not: null } },
    _count: true,
    _sum: { boxes: true, weight: true, cbm: true, priceToCustomerSum: true },
  });
  let idx = 0;
  const rows: ReportRow[] = fromContainers.map((g) => {
    idx += 1;
    return {
      id: idx,
      policyNo: "INV",
      containerNo: g.itemName ?? "—",
      received: false,
      shipDate: null,
      arrivalDate: null,
      release: "",
      country: "",
      axis: "",
      receiver: "",
      receiverNo: "",
      cartons: g._sum.boxes ?? 0,
      weight: g._sum.weight != null ? Number(g._sum.weight) : null,
      contents: `أسطر ${g._count} | قيمة للزبون ${Number(g._sum.priceToCustomerSum ?? 0).toFixed(2)}`,
      clearanceCo: "",
      profit: Number(g._sum.priceToCustomerSum ?? 0),
      selected: false,
    };
  });
  const totalProfit = rows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  return { tab: "mat-inv" as const, rows, meta: { totalProfit, containerCount: rows.length } };
}

async function allMaterialsMovesReport(_filters: Record<string, unknown>) {
  const [cli, pil, sil] = await Promise.all([
    prisma.containerLineItem.findMany({
      take: 60,
      orderBy: { id: "desc" },
      include: { container: { select: { containerNo: true } } },
    }),
    prisma.purchaseVoucherLine.findMany({
      take: 60,
      orderBy: { id: "desc" },
      include: { voucher: { select: { voucherNo: true } } },
    }),
    prisma.saleVoucherLine.findMany({
      take: 60,
      orderBy: { id: "desc" },
      include: { voucher: { select: { voucherNo: true } } },
    }),
  ]);
  const rows: ReportRow[] = [];
  let idx = 0;
  for (const l of cli) {
    idx += 1;
    rows.push({
      id: idx,
      policyNo: "CONT",
      containerNo: l.container.containerNo,
      received: false,
      shipDate: null,
      arrivalDate: null,
      release: "",
      country: "container-line",
      axis: "",
      receiver: l.itemName ?? "",
      receiverNo: l.itemNo ?? "",
      cartons: l.boxes,
      weight: l.weight != null ? Number(l.weight) : null,
      contents: `سطر حاوية seq ${l.seq}`,
      clearanceCo: "",
      profit: l.priceToCustomer != null ? Number(l.priceToCustomer) : 0,
      selected: false,
    });
  }
  for (const l of pil) {
    idx += 1;
    rows.push({
      id: idx,
      policyNo: "PUR",
      containerNo: l.voucher.voucherNo,
      received: false,
      shipDate: null,
      arrivalDate: null,
      release: "",
      country: "purchase-line",
      axis: "",
      receiver: l.itemName ?? "",
      receiverNo: l.itemNo ?? "",
      cartons: null,
      weight: l.weight != null ? Number(l.weight) : null,
      contents: `سطر شراء seq ${l.seq}`,
      clearanceCo: "",
      profit: l.unitPrice != null ? Number(l.unitPrice) : 0,
      selected: false,
    });
  }
  for (const l of sil) {
    idx += 1;
    rows.push({
      id: idx,
      policyNo: "SAL",
      containerNo: l.voucher.voucherNo,
      received: false,
      shipDate: null,
      arrivalDate: null,
      release: "",
      country: "sale-line",
      axis: "",
      receiver: l.detail ?? "",
      receiverNo: l.itemNo ?? "",
      cartons: null,
      weight: l.weight != null ? Number(l.weight) : null,
      contents: `سطر بيع seq ${l.seq}`,
      clearanceCo: "",
      profit: l.totalPrice != null ? Number(l.totalPrice) : 0,
      selected: false,
    });
  }
  const totalProfit = rows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  return { tab: "all-moves" as const, rows, meta: { totalProfit, containerCount: rows.length } };
}
