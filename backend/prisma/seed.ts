import "dotenv/config";
import bcrypt from "bcrypt";
import {
  PrismaClient,
  PartyType,
  ContainerStatus,
  GlAccountClass,
  AppModule,
  type UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function seedFinanceBasics() {
  if (!(await prisma.documentSequence.findUnique({ where: { key: "JOURNAL" } }))) {
    await prisma.documentSequence.create({ data: { key: "JOURNAL", prefix: "JE", nextNum: 1 } });
    console.log("Seeded DocumentSequence JOURNAL");
  }

  const coa: { code: string; name: string; nameAr: string; class: GlAccountClass }[] = [
    { code: "1000", name: "Cash / Bank", nameAr: "النقدية والبنوك", class: GlAccountClass.ASSET },
    { code: "1200", name: "Accounts Receivable", nameAr: "الذمم المدينة", class: GlAccountClass.ASSET },
    { code: "1300", name: "Inventory", nameAr: "المخزون", class: GlAccountClass.ASSET },
    { code: "2000", name: "Accounts Payable", nameAr: "الذمم الدائنة", class: GlAccountClass.LIABILITY },
    { code: "3000", name: "Equity", nameAr: "حقوق الملكية", class: GlAccountClass.EQUITY },
    { code: "4000", name: "Revenue", nameAr: "الإيرادات", class: GlAccountClass.REVENUE },
    { code: "5000", name: "Expenses", nameAr: "المصروفات", class: GlAccountClass.EXPENSE },
  ];
  for (const row of coa) {
    await prisma.glAccount.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        nameAr: row.nameAr,
        class: row.class,
        isPosting: true,
        isActive: true,
      },
      update: {},
    });
  }
  console.log("Seeded chart of accounts (if missing)");

  const yStart = new Date("2026-01-01T12:00:00.000Z");
  const yEnd = new Date("2026-12-31T23:59:59.999Z");
  const overlap = await prisma.fiscalYear.findFirst({
    where: { startDate: { lte: yEnd }, endDate: { gte: yStart } },
  });
  if (!overlap) {
    const y = await prisma.fiscalYear.create({
      data: { label: "2026", startDate: yStart, endDate: yEnd },
    });
    let idx = 1;
    let curStart = new Date(yStart);
    while (curStart <= yEnd) {
      const monthEnd = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 0, 23, 59, 59, 999);
      const pEnd = monthEnd > yEnd ? yEnd : monthEnd;
      await prisma.fiscalPeriod.create({
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
    console.log("Seeded fiscal year 2026 with periods");
  }
}

async function seedRolePermissions() {
  const n = await prisma.rolePermission.count();
  if (n > 0) return;

  const allow = (role: UserRole, module: AppModule, actions: string[]) =>
    actions.map((action) => ({ role, module, action, allowed: true }));

  const rows = [
    ...allow("ACCOUNTANT", "SALES", ["CREATE", "EDIT", "SUBMIT", "APPROVE", "POST", "DELETE"]),
    ...allow("ACCOUNTANT", "PURCHASES", ["CREATE", "EDIT", "SUBMIT", "APPROVE", "POST", "DELETE"]),
    ...allow("ACCOUNTANT", "FINANCE", ["VAT_REPORT"]),
    ...allow("DATA_ENTRY", "SALES", ["CREATE", "EDIT", "SUBMIT"]),
    ...allow("DATA_ENTRY", "PURCHASES", ["CREATE", "EDIT", "SUBMIT"]),
    ...allow("DATA_ENTRY", "SETTINGS", ["NOTIFICATIONS_READ"]),
    ...allow("ACCOUNTANT", "SETTINGS", ["NOTIFICATIONS_READ"]),
    ...allow("STORE_KEEPER", "SETTINGS", ["NOTIFICATIONS_READ"]),
    ...allow("USER", "SETTINGS", ["NOTIFICATIONS_READ"]),
  ];

  await prisma.rolePermission.createMany({ data: rows });
  console.log(`Seeded ${rows.length} role permission rows`);
}

async function main() {
  await seedFinanceBasics();
  await seedRolePermissions();

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "adminadmin123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, passwordHash, role: "ADMIN" },
    });
    console.log("Seeded admin user:", email);
  }

  let supplier = await prisma.party.findFirst({ where: { type: PartyType.SUPPLIER, name: "مخازن القرغوليه حسابات" } });
  if (!supplier) {
    supplier = await prisma.party.create({
      data: {
        type: PartyType.SUPPLIER,
        name: "مخازن القرغوليه حسابات",
        phone: "0780000000",
        balanceDisplay: "874092.7847 balance",
      },
    });
  }

  let customer = await prisma.party.findFirst({ where: { type: PartyType.CUSTOMER, name: "نهاد كريم" } });
  if (!customer) {
    customer = await prisma.party.create({
      data: { type: PartyType.CUSTOMER, name: "نهاد كريم", phone: "07707100222" },
    });
  }

  let clearance = await prisma.party.findFirst({
    where: { type: PartyType.CLEARANCE, name: "شركة الفجر الهنديه" },
  });
  if (!clearance) {
    clearance = await prisma.party.create({
      data: { type: PartyType.CLEARANCE, name: "شركة الفجر الهنديه" },
    });
  }

  let store = await prisma.store.findFirst({ where: { name: "المخزن الرئيسي" } });
  if (!store) {
    store = await prisma.store.create({ data: { name: "المخزن الرئيسي" } });
  }

  let container = await prisma.container.findFirst({
    where: { containerNo: "msc-bmou6592613" },
  });
  if (!container) {
    container = await prisma.container.create({
      data: {
        containerNo: "msc-bmou6592613",
        documentDate: new Date("2026-01-07"),
        isLoaded: true,
        centralPoint: "بغداد",
        sourceCountry: "ابور",
        contents: "قبل عيار هيتر وقبل عيار صمامات دسنگ",
        chinaExchangeRate: 6.8,
        status: ContainerStatus.OPEN,
        customerId: customer.id,
        clearanceCompanyId: clearance.id,
        policyNo: "BL-2001",
        shipDate: new Date("2026-01-15"),
        arriveDate: new Date("2026-01-30"),
        country: "الصين",
        axis: "بغداد",
        receiverName: "مستلم 1",
        receiverPhone: "0770000001",
        cartonsTotal: 80,
        weightTotal: 1200,
        profit: 2898.5,
        received: true,
      },
    });
    await prisma.containerLineItem.createMany({
      data: [
        {
          containerId: container.id,
          seq: 1,
          pieceTransport: 17.31,
          weightSum: 2453.88,
          weight: 15.73,
          cbmSum: 18.0024,
          cbm: 0.1154,
          priceToCustomer: 2624,
          boxes: 156,
          pieces: 156,
          byPriceSum: 50326.0056,
          cartonPcs: 1,
          byPrice: 322.6026,
          itemName: "مواد ابو قاسم",
          itemNo: "٠٧٩٠٤٠١٥٩٢١٦٤",
          hasItem: false,
        },
      ],
    });
    await prisma.containerCostLine.createMany({
      data: [
        { containerId: container.id, sortOrder: 0, label: "container emptying coast", amount: 3250, description: "Container Targit" },
        { containerId: container.id, sortOrder: 1, amount: 450, description: "China Inner transport Coast" },
        { containerId: container.id, sortOrder: 2, amount: 5000, description: "basra customs coast" },
      ],
    });
  }

  const vExists = await prisma.purchaseInvoiceVoucher.findFirst({
    where: { voucherNo: "195", currency: "دولار" },
  });
  if (!vExists && container) {
    await prisma.purchaseInvoiceVoucher.create({
      data: {
        voucherNo: "195",
        voucherDate: new Date("2026-03-21"),
        exchangeRate: 6.7,
        currency: "دولار",
        containerId: container.id,
        supplierId: supplier.id,
        storeId: store.id,
        summation: 5137.62,
        paid: 0,
        balance: 874092.7847,
        lines: {
          create: [
            {
              seq: 1,
              priceToCustomerSum: 1005.6,
              weightSum: 2.095,
              weight: 6.204,
              cbmSum: 0.0517,
              cbm: 120,
              boxesSum: 480,
              piecesSum: 3120,
              priceSum: 4,
              cartonPcs: 6.5,
              itemName: "مناخ ٢٠٠٣",
              itemNo: "pride-85a",
            },
          ],
        },
      },
    });
  }

  const saleExists = await prisma.saleVoucher.findFirst({
    where: { voucherNo: "264", currency: "دولار" },
  });
  if (!saleExists && container) {
    await prisma.saleVoucher.create({
      data: {
        voucherNo: "264",
        voucherDate: new Date("2026-03-21"),
        exchangeRate: 6.8,
        currency: "دولار",
        containerId: container.id,
        customerId: customer.id,
        storeId: store.id,
        total: 14700,
        paid: 0,
        remaining: 14700,
        profit: 0,
        lines: {
          create: [
            {
              seq: 1,
              usdConvertRate: 2,
              listQty: 20,
              totalPrice: 2000,
              detail: "رافعات قصيرة عالية",
              itemNo: "PRIDI1",
            },
          ],
        },
      },
    });
  }

  if (!(await prisma.incomeOutcomeEntry.findFirst({ where: { documentNo: "EXP-1" } }))) {
    await prisma.incomeOutcomeEntry.create({
      data: {
        kind: "EXPENSE",
        entryDate: new Date("2026-01-30"),
        currency: "دولار",
        documentNo: "EXP-1",
        fees: 10,
        usdAmount: 50,
        detailsText: "sample expense",
      },
    });
  }
  if (!(await prisma.incomeOutcomeEntry.findFirst({ where: { documentNo: "REV-1" } }))) {
    await prisma.incomeOutcomeEntry.create({
      data: {
        kind: "REVENUE",
        entryDate: new Date("2026-01-30"),
        currency: "دولار",
        documentNo: "REV-1",
        fees: 0,
        usdAmount: 120,
        detailsText: "sample revenue",
      },
    });
  }

  const acc = await prisma.accountingMove.findFirst({ where: { searchQuery: "seed" } });
  if (!acc) {
    const move = await prisma.accountingMove.create({
      data: {
        moveDate: new Date("2026-01-30"),
        reportFrom: new Date("2026-01-30"),
        reportTo: new Date("2026-01-30"),
        exchangeRate: 6.8,
        searchQuery: "seed",
        lines: {
          create: [
            {
              direction: "OUT",
              dinar: 100,
              jineh: 0,
              usd: 50,
              rmb: 0,
              lineNo: "1",
              details: "debit sample",
              lineDate: new Date("2026-01-30"),
            },
            {
              direction: "IN",
              dinar: 0,
              jineh: 0,
              usd: 50,
              rmb: 10,
              lineNo: "1",
              details: "credit sample",
              lineDate: new Date("2026-01-30"),
            },
          ],
        },
      },
    });
    console.log("Seeded accounting move", move.id);
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
