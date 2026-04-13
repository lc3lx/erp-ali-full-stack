import "dotenv/config";
import bcrypt from "bcrypt";
import {
  AppModule,
  ContainerStatus,
  GlAccountClass,
  PartyType,
  PrismaClient,
  type UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

const USD = "ط¯ظˆظ„ط§ط±";
const IQD = "ط¯ظٹظ†ط§ط±";

async function ensureDocumentSequence() {
  const key = "JOURNAL";
  const row = await prisma.documentSequence.findUnique({ where: { key } });
  if (!row) {
    await prisma.documentSequence.create({ data: { key, prefix: "JE", nextNum: 1 } });
  }
}

async function ensureFiscalYear2026() {
  const start = new Date("2026-01-01T00:00:00.000Z");
  const end = new Date("2026-12-31T23:59:59.999Z");

  const existing = await prisma.fiscalYear.findFirst({
    where: { startDate: { lte: end }, endDate: { gte: start } },
  });
  if (existing) return existing;

  const year = await prisma.fiscalYear.create({
    data: { label: "FY-2026", startDate: start, endDate: end },
  });

  for (let month = 0; month < 12; month += 1) {
    const periodStart = new Date(Date.UTC(2026, month, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(2026, month + 1, 0, 23, 59, 59, 999));
    await prisma.fiscalPeriod.create({
      data: {
        yearId: year.id,
        index: month + 1,
        name: `2026-${String(month + 1).padStart(2, "0")}`,
        startDate: periodStart,
        endDate: periodEnd,
        status: "OPEN",
      },
    });
  }

  return year;
}

async function ensureChartOfAccounts() {
  const accounts: { code: string; name: string; nameAr: string; class: GlAccountClass }[] = [
    { code: "1000", name: "Cash / Bank", nameAr: "النقدية والبنوك", class: "ASSET" },
    { code: "1100", name: "Inventory", nameAr: "المخزون", class: "ASSET" },
    { code: "1200", name: "Accounts Receivable", nameAr: "الذمم المدينة", class: "ASSET" },
    { code: "2000", name: "Accounts Payable", nameAr: "الذمم الدائنة", class: "LIABILITY" },
    { code: "3000", name: "Equity", nameAr: "حقوق الملكية", class: "EQUITY" },
    { code: "4000", name: "Sales Revenue", nameAr: "إيرادات المبيعات", class: "REVENUE" },
    { code: "5000", name: "Operating Expense", nameAr: "مصاريف تشغيلية", class: "EXPENSE" },
  ];

  for (const acc of accounts) {
    await prisma.glAccount.upsert({
      where: { code: acc.code },
      create: {
        code: acc.code,
        name: acc.name,
        nameAr: acc.nameAr,
        class: acc.class,
        isPosting: true,
        isActive: true,
      },
      update: {
        name: acc.name,
        nameAr: acc.nameAr,
        class: acc.class,
        isActive: true,
      },
    });
  }
}

async function ensureRolePermissions() {
  const existing = await prisma.rolePermission.count();
  if (existing > 0) return;

  const allow = (role: UserRole, module: AppModule, actions: string[]) =>
    actions.map((action) => ({ role, module, action, allowed: true }));

  const rows = [
    ...allow("ADMIN", "SALES", ["VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "POST", "DELETE"]),
    ...allow("ADMIN", "PURCHASES", ["VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "POST", "DELETE"]),
    ...allow("ADMIN", "INVENTORY", ["VIEW", "CREATE", "EDIT", "TRANSFER", "ADJUST"]),
    ...allow("ACCOUNTANT", "SALES", ["VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "POST"]),
    ...allow("ACCOUNTANT", "PURCHASES", ["VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "POST"]),
    ...allow("ACCOUNTANT", "FINANCE", ["VIEW", "POST", "REPORTS"]),
    ...allow("STORE_KEEPER", "INVENTORY", ["VIEW", "TRANSFER", "ADJUST"]),
    ...allow("DATA_ENTRY", "SALES", ["VIEW", "CREATE", "EDIT", "SUBMIT"]),
    ...allow("DATA_ENTRY", "PURCHASES", ["VIEW", "CREATE", "EDIT", "SUBMIT"]),
    ...allow("USER", "SETTINGS", ["NOTIFICATIONS_READ"]),
  ];

  await prisma.rolePermission.createMany({ data: rows });
}

async function ensureUser(email: string, role: UserRole, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      role,
      passwordHash: hash,
    },
  });
}

async function ensureParty(type: PartyType, name: string, phone?: string, address?: string, saleDiscountDefault?: number) {
  const existing = await prisma.party.findFirst({ where: { type, name } });
  if (existing) return existing;
  return prisma.party.create({
    data: {
      type,
      name,
      phone: phone ?? null,
      address: address ?? null,
      saleDiscountDefault: saleDiscountDefault ?? null,
    },
  });
}

async function ensureStoreWithWarehouse(name: string, code: string) {
  let store = await prisma.store.findFirst({ where: { name } });
  if (!store) {
    store = await prisma.store.create({ data: { name } });
  }

  let warehouse = await prisma.invWarehouse.findFirst({ where: { storeId: store.id } });
  if (!warehouse) {
    warehouse = await prisma.invWarehouse.create({
      data: {
        name,
        storeId: store.id,
        code,
        isActive: true,
      },
    });
  } else {
    warehouse = await prisma.invWarehouse.update({
      where: { id: warehouse.id },
      data: { name, code, isActive: true },
    });
  }

  return { store, warehouse };
}

async function ensureItem(payload: {
  itemNo: string;
  name: string;
  barcode: string;
  category: string;
  defaultUom?: string;
}) {
  const existing = await prisma.item.findUnique({ where: { barcode: payload.barcode } });
  if (existing) {
    return prisma.item.update({
      where: { id: existing.id },
      data: {
        itemNo: payload.itemNo,
        name: payload.name,
        category: payload.category,
        defaultUom: payload.defaultUom ?? "PCS",
        isActive: true,
      },
    });
  }

  return prisma.item.create({
    data: {
      itemNo: payload.itemNo,
      name: payload.name,
      barcode: payload.barcode,
      category: payload.category,
      defaultUom: payload.defaultUom ?? "PCS",
      isActive: true,
    },
  });
}

async function ensureContainer(input: {
  containerNo: string;
  customerId: string;
  clearanceCompanyId: string;
  sourceCountry: string;
  centralPoint: string;
}) {
  let container = await prisma.container.findFirst({ where: { containerNo: input.containerNo } });
  if (!container) {
    container = await prisma.container.create({
      data: {
        containerNo: input.containerNo,
        documentDate: new Date("2026-02-01T00:00:00.000Z"),
        shipDate: new Date("2026-02-05T00:00:00.000Z"),
        arriveDate: new Date("2026-03-01T00:00:00.000Z"),
        sourceCountry: input.sourceCountry,
        centralPoint: input.centralPoint,
        status: ContainerStatus.RECEIVED,
        customerId: input.customerId,
        clearanceCompanyId: input.clearanceCompanyId,
        contents: "Container demo items",
        chinaExchangeRate: 6.8,
        isLoaded: true,
      },
    });
  }

  const linesCount = await prisma.containerLineItem.count({ where: { containerId: container.id } });
  if (linesCount === 0) {
    await prisma.containerLineItem.createMany({
      data: [
        {
          containerId: container.id,
          seq: 1,
          itemName: "قطع غيار متنوعة",
          itemNo: "SP-001",
          pieces: 240,
          boxes: 24,
          weight: 340,
          weightSum: 340,
          cbm: 11,
          cbmSum: 11,
          hasItem: false,
        },
        {
          containerId: container.id,
          seq: 2,
          itemName: "اكسسوارات كهربائية",
          itemNo: "EL-002",
          pieces: 180,
          boxes: 18,
          weight: 220,
          weightSum: 220,
          cbm: 8,
          cbmSum: 8,
          hasItem: false,
        },
      ],
    });
  }

  const costsCount = await prisma.containerCostLine.count({ where: { containerId: container.id } });
  if (costsCount === 0) {
    await prisma.containerCostLine.createMany({
      data: [
        { containerId: container.id, sortOrder: 1, label: "Freight", amount: 2500 },
        { containerId: container.id, sortOrder: 2, label: "Customs", amount: 1400 },
        { containerId: container.id, sortOrder: 3, label: "Handling", amount: 600 },
      ],
    });
  }

  return container;
}

function calcPurchaseSummation(lines: { priceToCustomerSum: number }[]) {
  return lines.reduce((sum, line) => sum + line.priceToCustomerSum, 0);
}

function calcSaleTotal(lines: { totalPrice: number }[]) {
  return lines.reduce((sum, line) => sum + line.totalPrice, 0);
}

async function ensurePurchaseVoucher(input: {
  voucherNo: string;
  containerId: string;
  supplierId: string;
  storeId: string;
  date: Date;
  lines: {
    itemId: string;
    itemNo: string;
    itemName: string;
    piecesSum: number;
    boxesSum: number;
    unitPrice: number;
    priceToCustomerSum: number;
  }[];
}) {
  const existing = await prisma.purchaseInvoiceVoucher.findFirst({
    where: { voucherNo: input.voucherNo, currency: USD },
  });
  if (existing) return existing;

  const summation = calcPurchaseSummation(input.lines);
  return prisma.purchaseInvoiceVoucher.create({
    data: {
      voucherNo: input.voucherNo,
      voucherDate: input.date,
      exchangeRate: 6.8,
      currency: USD,
      containerId: input.containerId,
      supplierId: input.supplierId,
      storeId: input.storeId,
      summation,
      paid: 0,
      balance: summation,
      lines: {
        create: input.lines.map((line, idx) => ({
          seq: idx + 1,
          itemId: line.itemId,
          itemNo: line.itemNo,
          itemName: line.itemName,
          piecesSum: line.piecesSum,
          boxesSum: line.boxesSum,
          unitPrice: line.unitPrice,
          priceToCustomerSum: line.priceToCustomerSum,
          priceSum: line.priceToCustomerSum,
          weight: 10 + idx,
          weightSum: 10 + idx,
          cbm: 1 + idx,
          cbmSum: 1 + idx,
        })),
      },
    },
  });
}

async function ensureSaleVoucher(input: {
  voucherNo: string;
  containerId: string;
  customerId: string;
  storeId: string;
  date: Date;
  lines: {
    itemId: string;
    itemNo: string;
    detail: string;
    listQty: number;
    totalPrice: number;
    linePrice: number;
  }[];
}) {
  const existing = await prisma.saleVoucher.findFirst({
    where: { voucherNo: input.voucherNo, currency: USD },
  });
  if (existing) return existing;

  const total = calcSaleTotal(input.lines);
  return prisma.saleVoucher.create({
    data: {
      voucherNo: input.voucherNo,
      voucherDate: input.date,
      exchangeRate: 6.8,
      currency: USD,
      containerId: input.containerId,
      customerId: input.customerId,
      storeId: input.storeId,
      total,
      paid: 0,
      remaining: total,
      profit: 0,
      lines: {
        create: input.lines.map((line, idx) => ({
          seq: idx + 1,
          itemId: line.itemId,
          itemNo: line.itemNo,
          detail: line.detail,
          listQty: line.listQty,
          totalPrice: line.totalPrice,
          linePrice: line.linePrice,
          usdConvertRate: 1,
          usdSumCol: line.totalPrice,
          usdPriceCol: line.linePrice,
          cbm1: 1,
          cbm2: 1,
          cbmSumCol: 1,
          weight: 1,
        })),
      },
    },
  });
}

async function ensureStockSeed(warehouses: { id: string }[], items: { id: string }[]) {
  for (let wi = 0; wi < warehouses.length; wi += 1) {
    const wh = warehouses[wi];

    for (let ii = 0; ii < items.length; ii += 1) {
      const item = items[ii];
      const qty = 120 + wi * 35 + ii * 7;
      const unitCost = 4 + (ii % 5) * 0.5;
      const referenceId = `SEED-OPEN-${wh.id}-${item.id}`;

      const move = await prisma.invStockMove.findFirst({
        where: {
          referenceKind: "INVENTORY",
          referenceId,
          warehouseId: wh.id,
          itemId: item.id,
          type: "OPENING",
        },
      });

      if (!move) {
        await prisma.invStockMove.create({
          data: {
            moveDate: new Date("2026-01-01T00:00:00.000Z"),
            warehouseId: wh.id,
            itemId: item.id,
            type: "OPENING",
            qty,
            unitCost,
            totalCost: qty * unitCost,
            referenceKind: "INVENTORY",
            referenceId,
          },
        });
      }

      await prisma.invStockBalance.upsert({
        where: { warehouseId_itemId: { warehouseId: wh.id, itemId: item.id } },
        create: {
          warehouseId: wh.id,
          itemId: item.id,
          qtyOnHand: qty,
          avgUnitCost: unitCost,
        },
        update: {
          qtyOnHand: qty,
          avgUnitCost: unitCost,
        },
      });
    }
  }
}

async function seedHrAndCrm(customers: { id: string }[]) {
  const employeeDefs = [
    { fullName: "أحمد سامي", phone: "0770000101", baseSalary: 950 },
    { fullName: "ليلى خالد", phone: "0770000102", baseSalary: 1200 },
    { fullName: "نوران فاضل", phone: "0770000103", baseSalary: 880 },
  ];

  for (const emp of employeeDefs) {
    const existing = await prisma.employee.findFirst({ where: { fullName: emp.fullName } });
    const row =
      existing ??
      (await prisma.employee.create({
        data: {
          fullName: emp.fullName,
          phone: emp.phone,
          baseSalary: emp.baseSalary,
          hireDate: new Date("2025-11-01T00:00:00.000Z"),
          isActive: true,
        },
      }));

    const loan = await prisma.employeeLoan.findFirst({ where: { employeeId: row.id } });
    if (!loan) {
      await prisma.employeeLoan.create({
        data: {
          employeeId: row.id,
          principal: 500,
          paidAmount: 100,
          installment: 50,
          startDate: new Date("2026-01-15T00:00:00.000Z"),
          notes: "Sample loan",
        },
      });
    }
  }

  const leadNames = ["شركة الأفق", "متجر المدينة", "مؤسسة الريان", "شركة النور"];
  for (const name of leadNames) {
    const existing = await prisma.crmLead.findFirst({ where: { name } });
    if (!existing) {
      await prisma.crmLead.create({
        data: {
          name,
          phone: "0781000000",
          company: name,
          status: "NEW",
          notes: "Demo lead",
        },
      });
    }
  }

  for (let i = 0; i < Math.min(customers.length, 3); i += 1) {
    const quoteNo = `QT-2026-00${i + 1}`;
    const existing = await prisma.crmQuotation.findUnique({ where: { quoteNo } });
    if (!existing) {
      await prisma.crmQuotation.create({
        data: {
          quoteNo,
          quoteDate: new Date(`2026-03-0${i + 1}T00:00:00.000Z`),
          customerId: customers[i].id,
          title: `عرض سعر ${i + 1}`,
          total: 1500 + i * 300,
          status: "DRAFT",
          notes: "Quotation demo data",
        },
      });
    }
  }
}

async function seedMisc() {
  const io = [
    { kind: "EXPENSE" as const, documentNo: "EXP-2026-001", amountUsd: 120, fees: 10 },
    { kind: "EXPENSE" as const, documentNo: "EXP-2026-002", amountUsd: 65, fees: 5 },
    { kind: "REVENUE" as const, documentNo: "REV-2026-001", amountUsd: 220, fees: 0 },
    { kind: "REVENUE" as const, documentNo: "REV-2026-002", amountUsd: 540, fees: 0 },
  ];

  for (const row of io) {
    const existing = await prisma.incomeOutcomeEntry.findFirst({ where: { documentNo: row.documentNo } });
    if (!existing) {
      await prisma.incomeOutcomeEntry.create({
        data: {
          kind: row.kind,
          entryDate: new Date("2026-03-10T00:00:00.000Z"),
          currency: USD,
          documentNo: row.documentNo,
          amountUsd: row.amountUsd,
          fees: row.fees,
          detailsText: "Demo income/outcome record",
        },
      });
    }
  }

  const existingDoc = await prisma.officialDocument.findFirst({ where: { subject: "عقد توريد تجريبي" } });
  if (!existingDoc) {
    await prisma.officialDocument.create({
      data: {
        serial1: "DOC-2026-01",
        recipient: "شركة تجريبية",
        subject: "عقد توريد تجريبي",
        body: "هذا مستند تجريبي مخصص لاختبار الطباعة والاستعراض.",
      },
    });
  }

  const existingMove = await prisma.accountingMove.findFirst({ where: { searchQuery: "seed-demo" } });
  if (!existingMove) {
    await prisma.accountingMove.create({
      data: {
        moveDate: new Date("2026-03-15T00:00:00.000Z"),
        reportFrom: new Date("2026-03-01T00:00:00.000Z"),
        reportTo: new Date("2026-03-31T23:59:59.999Z"),
        exchangeRate: 6.8,
        topCurrency: USD,
        searchQuery: "seed-demo",
        lines: {
          create: [
            {
              direction: "OUT",
              panelCurrency: USD,
              usd: 250,
              lineNo: "1",
              details: "Seed debit",
              lineDate: new Date("2026-03-15T00:00:00.000Z"),
            },
            {
              direction: "IN",
              panelCurrency: USD,
              usd: 250,
              lineNo: "2",
              details: "Seed credit",
              lineDate: new Date("2026-03-15T00:00:00.000Z"),
            },
          ],
        },
      },
    });
  }

  const usdSnap = await prisma.exchangeRateSnapshot.findFirst({ where: { label: USD } });
  if (!usdSnap) {
    await prisma.exchangeRateSnapshot.create({ data: { label: USD, rate: 1 } });
  }
  const iqdSnap = await prisma.exchangeRateSnapshot.findFirst({ where: { label: IQD } });
  if (!iqdSnap) {
    await prisma.exchangeRateSnapshot.create({ data: { label: IQD, rate: 1450 } });
  }
}

async function main() {
  await ensureDocumentSequence();
  await ensureFiscalYear2026();
  await ensureChartOfAccounts();
  await ensureRolePermissions();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "adminadmin123";
  await ensureUser(adminEmail, "ADMIN", adminPassword);
  await ensureUser("accountant@example.com", "ACCOUNTANT", "accountant123");
  await ensureUser("entry@example.com", "DATA_ENTRY", "entry123456");
  await ensureUser("store@example.com", "STORE_KEEPER", "store123456");

  const customers = [
    await ensureParty("CUSTOMER", "شركة الرافدين للتجارة", "0770001001", "بغداد", 5),
    await ensureParty("CUSTOMER", "مؤسسة النخبة", "0770001002", "البصرة", 3),
    await ensureParty("CUSTOMER", "متجر المدينة", "0770001003", "أربيل", 2),
    await ensureParty("CUSTOMER", "شركة الهدى", "0770001004", "النجف", 4),
    await ensureParty("CUSTOMER", "الأنوار للصيانة", "0770001005", "الموصل", 0),
  ];

  const suppliers = [
    await ensureParty("SUPPLIER", "مصنع الأمل", "0780002001", "الصين"),
    await ensureParty("SUPPLIER", "شركة النهضة للاستيراد", "0780002002", "تركيا"),
    await ensureParty("SUPPLIER", "مجموعة الخليج", "0780002003", "الإمارات"),
    await ensureParty("SUPPLIER", "مخازن الشرق", "0780002004", "الأردن"),
  ];

  const clearance = [
    await ensureParty("CLEARANCE", "التخليص المتحدة", "0790003001", "أم قصر"),
    await ensureParty("CLEARANCE", "العبور الذكي", "0790003002", "البصرة"),
  ];

  await ensureParty("SHIPPER", "Blue Ocean Shipping", "0791004001", "Shanghai");
  await ensureParty("SHIPPER", "Delta Cargo", "0791004002", "Shenzhen");

  const stores = [
    await ensureStoreWithWarehouse("Main Store", "MAIN"),
    await ensureStoreWithWarehouse("Baghdad Store", "BGD"),
    await ensureStoreWithWarehouse("Basra Store", "BSR"),
  ];

  const itemDefs = [
    { itemNo: "ITM-001", name: "فلتر زيت", barcode: "BDM-0001", category: "Spare Parts" },
    { itemNo: "ITM-002", name: "فلتر هواء", barcode: "BDM-0002", category: "Spare Parts" },
    { itemNo: "ITM-003", name: "بوجي", barcode: "BDM-0003", category: "Ignition" },
    { itemNo: "ITM-004", name: "بطارية 70 أمبير", barcode: "BDM-0004", category: "Electrical" },
    { itemNo: "ITM-005", name: "زيت محرك 20W-50", barcode: "BDM-0005", category: "Lubricants" },
    { itemNo: "ITM-006", name: "سير دينمو", barcode: "BDM-0006", category: "Belts" },
    { itemNo: "ITM-007", name: "سير تايمن", barcode: "BDM-0007", category: "Belts" },
    { itemNo: "ITM-008", name: "طرمبة ماء", barcode: "BDM-0008", category: "Cooling" },
    { itemNo: "ITM-009", name: "راديتر", barcode: "BDM-0009", category: "Cooling" },
    { itemNo: "ITM-010", name: "كمبريسر مكيف", barcode: "BDM-0010", category: "AC" },
    { itemNo: "ITM-011", name: "دينمو", barcode: "BDM-0011", category: "Electrical" },
    { itemNo: "ITM-012", name: "بادئ تشغيل", barcode: "BDM-0012", category: "Electrical" },
    { itemNo: "ITM-013", name: "صحن كلتش", barcode: "BDM-0013", category: "Transmission" },
    { itemNo: "ITM-014", name: "ديسك كلتش", barcode: "BDM-0014", category: "Transmission" },
    { itemNo: "ITM-015", name: "بلف ثرموستات", barcode: "BDM-0015", category: "Cooling" },
    { itemNo: "ITM-016", name: "فلتر بنزين", barcode: "BDM-0016", category: "Fuel" },
    { itemNo: "ITM-017", name: "طرمبة بنزين", barcode: "BDM-0017", category: "Fuel" },
    { itemNo: "ITM-018", name: "حساس كرنك", barcode: "BDM-0018", category: "Sensors" },
  ];

  const items = [];
  for (const def of itemDefs) {
    items.push(await ensureItem(def));
  }

  const containers = [];
  for (let i = 0; i < 6; i += 1) {
    const c = await ensureContainer({
      containerNo: `CN-2026-${String(i + 1).padStart(3, "0")}`,
      customerId: customers[i % customers.length].id,
      clearanceCompanyId: clearance[i % clearance.length].id,
      sourceCountry: i % 2 === 0 ? "China" : "Turkey",
      centralPoint: i % 2 === 0 ? "Baghdad" : "Basra",
    });
    containers.push(c);
  }

  for (let i = 0; i < 6; i += 1) {
    const store = stores[i % stores.length].store;
    const supplier = suppliers[i % suppliers.length];
    const container = containers[i % containers.length];
    const a = items[(i * 2) % items.length];
    const b = items[(i * 2 + 1) % items.length];

    await ensurePurchaseVoucher({
      voucherNo: `PV-2026-${String(i + 1).padStart(3, "0")}`,
      containerId: container.id,
      supplierId: supplier.id,
      storeId: store.id,
      date: new Date(`2026-03-${String(3 + i).padStart(2, "0")}T00:00:00.000Z`),
      lines: [
        {
          itemId: a.id,
          itemNo: a.itemNo ?? "",
          itemName: a.name,
          piecesSum: 80 + i * 5,
          boxesSum: 8 + i,
          unitPrice: 4.5 + i,
          priceToCustomerSum: 800 + i * 90,
        },
        {
          itemId: b.id,
          itemNo: b.itemNo ?? "",
          itemName: b.name,
          piecesSum: 60 + i * 4,
          boxesSum: 6 + i,
          unitPrice: 5.5 + i,
          priceToCustomerSum: 650 + i * 85,
        },
      ],
    });
  }

  for (let i = 0; i < 6; i += 1) {
    const store = stores[i % stores.length].store;
    const customer = customers[i % customers.length];
    const container = containers[i % containers.length];
    const a = items[(i * 3) % items.length];
    const b = items[(i * 3 + 1) % items.length];

    await ensureSaleVoucher({
      voucherNo: `SV-2026-${String(i + 1).padStart(3, "0")}`,
      containerId: container.id,
      customerId: customer.id,
      storeId: store.id,
      date: new Date(`2026-04-${String(4 + i).padStart(2, "0")}T00:00:00.000Z`),
      lines: [
        {
          itemId: a.id,
          itemNo: a.itemNo ?? "",
          detail: `بيع ${a.name}`,
          listQty: 20 + i,
          totalPrice: 1200 + i * 110,
          linePrice: 60 + i,
        },
        {
          itemId: b.id,
          itemNo: b.itemNo ?? "",
          detail: `بيع ${b.name}`,
          listQty: 15 + i,
          totalPrice: 950 + i * 95,
          linePrice: 50 + i,
        },
      ],
    });
  }

  await ensureStockSeed(
    stores.map((s) => ({ id: s.warehouse.id })),
    items.slice(0, 12).map((item) => ({ id: item.id })),
  );

  await seedHrAndCrm(customers.map((c) => ({ id: c.id })));
  await seedMisc();

  console.log("Seed completed with demo data across ERP modules.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
