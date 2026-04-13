import "./env-shim.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";

const app = createApp();

describe("health", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /health/live", async () => {
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.check).toBe("live");
  });
});

describe("auth and error contracts", () => {
  it("POST /api/v1/auth/login rejects invalid payload", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "bad-mail",
      password: "123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");
    expect(res.body.error?.requestId).toBeTruthy();
  });

  it("GET /api/v1/containers requires bearer token", async () => {
    const res = await request(app).get("/api/v1/containers");
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe("UNAUTHORIZED");
    expect(res.body.error?.requestId).toBeTruthy();
  });
});

describe("api (PostgreSQL + seed optional)", () => {
  let dbReady = false;
  let token = "";
  let containerId = "";
  let supplierId = "";
  let customerId = "";
  let apAccountId = "";
  let expenseAccountId = "";
  let arAccountId = "";
  let revenueAccountId = "";

  beforeAll(async () => {
    try {
      await prisma.$connect();
      const email = "admin@example.com";
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.warn(
          "[vitest] No admin user: run `docker compose up -d`, `npx prisma migrate deploy`, `npm run db:seed`",
        );
        return;
      }
      const res = await request(app).post("/api/v1/auth/login").send({
        email,
        password: "adminadmin123",
      });
      if (res.status === 200 && res.body.token) {
        dbReady = true;
        token = res.body.token;
      }
      const [container, supplier, customer, apAccount, expenseAccount, arAccount, revenueAccount] =
        await Promise.all([
          prisma.container.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }),
          prisma.party.findFirst({ where: { type: "SUPPLIER" }, select: { id: true } }),
          prisma.party.findFirst({ where: { type: "CUSTOMER" }, select: { id: true } }),
          prisma.glAccount.findFirst({ where: { class: "LIABILITY", isPosting: true }, select: { id: true } }),
          prisma.glAccount.findFirst({ where: { class: "EXPENSE", isPosting: true }, select: { id: true } }),
          prisma.glAccount.findFirst({ where: { class: "ASSET", isPosting: true }, select: { id: true } }),
          prisma.glAccount.findFirst({ where: { class: "REVENUE", isPosting: true }, select: { id: true } }),
        ]);
      if (!container || !supplier || !customer || !apAccount || !expenseAccount || !arAccount || !revenueAccount) {
        dbReady = false;
        console.warn("[vitest] Missing seed accounting entities; skipping voucher accounting tests.");
      } else {
        containerId = container.id;
        supplierId = supplier.id;
        customerId = customer.id;
        apAccountId = apAccount.id;
        expenseAccountId = expenseAccount.id;
        arAccountId = arAccount.id;
        revenueAccountId = revenueAccount.id;
      }
    } catch {
      console.warn("[vitest] Database unreachable; skipping authenticated API tests.");
    }
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

  it("GET /api/v1/containers with bearer", async (ctx) => {
    if (!dbReady) ctx.skip();
    const res = await request(app)
      .get("/api/v1/containers")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
  });

  it("GET /api/v1/reports/run?tab=cont-inv", async (ctx) => {
    if (!dbReady) ctx.skip();
    const res = await request(app)
      .get("/api/v1/reports/run")
      .query({ tab: "cont-inv" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("rows");
    expect(res.body).toHaveProperty("meta");
  });

  it("GET /api/v1/finance/reports/trial-balance/summary", async (ctx) => {
    if (!dbReady) ctx.skip();
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app)
      .get("/api/v1/finance/reports/trial-balance/summary")
      .query({ from, to })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalDebit");
    expect(res.body).toHaveProperty("totalCredit");
    expect(res.body).toHaveProperty("isBalanced");
  });

  it("purchase voucher totals + post + repost reject", async (ctx) => {
    if (!dbReady) ctx.skip();
    const voucherNo = `PV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const create = await request(app)
      .post("/api/v1/invoice-vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        voucherNo,
        currency: "دولار",
        containerId,
        supplierId,
        paid: 0,
      });
    expect(create.status).toBe(201);
    const voucherId = create.body.id as string;

    const addLine = await request(app)
      .post(`/api/v1/invoice-vouchers/${voucherId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        priceToCustomerSum: "120",
      });
    expect(addLine.status).toBe(201);

    const totals = await request(app)
      .get(`/api/v1/invoice-vouchers/${voucherId}/totals`)
      .set("Authorization", `Bearer ${token}`);
    expect(totals.status).toBe(200);
    expect(Number(totals.body.summation)).toBe(120);
    expect(Number(totals.body.balance)).toBe(120);

    const submit = await request(app)
      .post(`/api/v1/invoice-vouchers/${voucherId}/workflow/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit.status).toBe(200);

    const approve = await request(app)
      .post(`/api/v1/invoice-vouchers/${voucherId}/workflow/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(approve.status).toBe(200);

    const post = await request(app)
      .post(`/api/v1/finance/post/purchase-voucher/${voucherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ debitAccountId: expenseAccountId, apAccountId });
    expect(post.status).toBe(201);

    const repost = await request(app)
      .post(`/api/v1/finance/post/purchase-voucher/${voucherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ debitAccountId: expenseAccountId, apAccountId });
    expect(repost.status).toBe(409);
  });

  it("sale voucher totals + post + repost reject", async (ctx) => {
    if (!dbReady) ctx.skip();
    const voucherNo = `SV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const create = await request(app)
      .post("/api/v1/invoice-sale")
      .set("Authorization", `Bearer ${token}`)
      .send({
        voucherNo,
        currency: "دولار",
        containerId,
        customerId,
        paid: 0,
      });
    expect(create.status).toBe(201);
    const voucherId = create.body.id as string;

    const addLine = await request(app)
      .post(`/api/v1/invoice-sale/${voucherId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalPrice: "250",
      });
    expect(addLine.status).toBe(201);

    const totals = await request(app)
      .get(`/api/v1/invoice-sale/${voucherId}/totals`)
      .set("Authorization", `Bearer ${token}`);
    expect(totals.status).toBe(200);
    expect(Number(totals.body.total)).toBe(250);
    expect(Number(totals.body.remaining)).toBe(250);

    const submit = await request(app)
      .post(`/api/v1/invoice-sale/${voucherId}/workflow/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit.status).toBe(200);

    const approve = await request(app)
      .post(`/api/v1/invoice-sale/${voucherId}/workflow/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(approve.status).toBe(200);

    const post = await request(app)
      .post(`/api/v1/finance/post/sale-voucher/${voucherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ arAccountId, revenueAccountId });
    expect(post.status).toBe(201);

    const repost = await request(app)
      .post(`/api/v1/finance/post/sale-voucher/${voucherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ arAccountId, revenueAccountId });
    expect(repost.status).toBe(409);
  });
});
