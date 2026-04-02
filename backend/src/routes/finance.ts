import { Router } from "express";
import { z } from "zod";
import { FiscalPeriodStatus, GlAccountClass, JournalEntryStatus, Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import { routeParam } from "../utils/params.js";
import { requireRole } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import * as fin from "../services/financeService.js";
import * as postSvc from "../services/documentPostingService.js";
import * as tax from "../services/taxService.js";
import * as analytics from "../services/erpAnalyticsService.js";
import * as treasury from "../services/treasuryService.js";
import * as recon from "../services/reconciliationService.js";
import * as bankStmt from "../services/bankStatementService.js";
import * as fxRev from "../services/fxRevaluationService.js";
import { prisma } from "../db/client.js";
import { ReconciliationMatchType } from "@prisma/client";

export const financeRouter = Router();

const isoDate = z.union([z.string().datetime(), z.coerce.date()]);

function uid(req: { user?: { id: string } }) {
  return req.user?.id;
}

/* Accounts */
financeRouter.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        q: z.string().optional(),
        class: z.nativeEnum(GlAccountClass).optional(),
        activeOnly: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);
    res.json({
      items: await fin.listGlAccounts({
        q: q.q,
        class: q.class,
        activeOnly: q.activeOnly !== "false",
      }),
    });
  }),
);

financeRouter.post(
  "/accounts",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
        nameAr: z.string().optional().nullable(),
        class: z.nativeEnum(GlAccountClass),
        parentId: z.string().uuid().optional().nullable(),
        isPosting: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body);
    const a = await fin.createGlAccount(body, uid(req));
    res.status(201).json(a);
  }),
);

financeRouter.get(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    res.json(await fin.getGlAccount(routeParam(req.params.id)));
  }),
);

financeRouter.patch(
  "/accounts/:id",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        nameAr: z.string().optional().nullable(),
        parentId: z.string().uuid().optional().nullable(),
        isPosting: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body);
    res.json(await fin.updateGlAccount(routeParam(req.params.id), body, uid(req)));
  }),
);

/* Fiscal */
financeRouter.get(
  "/fiscal-years",
  asyncHandler(async (_req, res) => {
    res.json({ items: await fin.listFiscalYears() });
  }),
);

financeRouter.post(
  "/fiscal-years",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        label: z.string().min(1),
        startDate: isoDate,
        endDate: isoDate,
      })
      .parse(req.body);
    const y = await fin.createFiscalYear(
      body.label,
      new Date(body.startDate),
      new Date(body.endDate),
      uid(req),
    );
    res.status(201).json(y);
  }),
);

financeRouter.patch(
  "/periods/:id/status",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z.object({ status: z.nativeEnum(FiscalPeriodStatus) }).parse(req.body);
    res.json(await fin.setPeriodStatus(routeParam(req.params.id), body.status, uid(req)));
  }),
);

/* Journals */
const lineSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  containerId: z.string().uuid().optional().nullable(),
  storeId: z.string().uuid().optional().nullable(),
  currency: z.string().optional(),
  exchangeRate: z.union([z.number(), z.string()]).optional().nullable(),
  debit: z.union([z.number(), z.string()]).optional().nullable(),
  credit: z.union([z.number(), z.string()]).optional().nullable(),
});

financeRouter.get(
  "/journal-entries",
  asyncHandler(async (req, res) => {
    const q = paginationQuerySchema
      .extend({
        status: z.nativeEnum(JournalEntryStatus).optional(),
      })
      .parse(req.query);
    res.json(await fin.listJournalEntries(q));
  }),
);

financeRouter.post(
  "/journal-entries",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        entryDate: isoDate,
        description: z.string().optional(),
        lines: z.array(lineSchema).min(1),
      })
      .parse(req.body);
    const e = await fin.createJournalEntry(
      {
        entryDate: new Date(body.entryDate),
        description: body.description,
        lines: body.lines,
      },
      uid(req),
    );
    res.status(201).json(e);
  }),
);

financeRouter.get(
  "/journal-entries/:id",
  asyncHandler(async (req, res) => {
    res.json(await fin.getJournalEntry(routeParam(req.params.id)));
  }),
);

financeRouter.patch(
  "/journal-entries/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        entryDate: isoDate.optional(),
        description: z.string().optional().nullable(),
      })
      .parse(req.body);
    res.json(
      await fin.updateJournalEntryDraft(
        routeParam(req.params.id),
        {
          ...(body.entryDate !== undefined ? { entryDate: new Date(body.entryDate) } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
        },
        uid(req),
      ),
    );
  }),
);

financeRouter.put(
  "/journal-entries/:id/lines",
  asyncHandler(async (req, res) => {
    const body = z.object({ lines: z.array(lineSchema).min(1) }).parse(req.body);
    res.json(await fin.replaceJournalLinesDraft(routeParam(req.params.id), body.lines, uid(req)));
  }),
);

financeRouter.post(
  "/journal-entries/:id/post",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    res.json(await fin.postJournalEntry(routeParam(req.params.id), uid(req)));
  }),
);

financeRouter.post(
  "/journal-entries/:id/void",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    res.json(await fin.voidJournalEntry(routeParam(req.params.id), uid(req)));
  }),
);

financeRouter.delete(
  "/journal-entries/:id",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    await fin.deleteJournalEntryDraft(routeParam(req.params.id), uid(req));
    res.status(204).send();
  }),
);

/* Reports */
financeRouter.get(
  "/reports/trial-balance",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        from: isoDate,
        to: isoDate,
      })
      .parse(req.query);
    res.json({
      from: new Date(q.from).toISOString(),
      to: new Date(q.to).toISOString(),
      rows: await fin.trialBalance(new Date(q.from), new Date(q.to)),
    });
  }),
);

financeRouter.get(
  "/reports/trial-balance/summary",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        from: isoDate,
        to: isoDate,
      })
      .parse(req.query);
    res.json(await fin.trialBalanceSummary(new Date(q.from), new Date(q.to)));
  }),
);

financeRouter.get(
  "/reports/ledger",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        accountId: z.string().uuid(),
        from: isoDate,
        to: isoDate,
      })
      .parse(req.query);
    res.json({
      accountId: q.accountId,
      from: new Date(q.from).toISOString(),
      to: new Date(q.to).toISOString(),
      ...(await fin.accountLedger(q.accountId, new Date(q.from), new Date(q.to))),
    });
  }),
);

financeRouter.post(
  "/post/sale-voucher/:voucherId",
  requireRole("ADMIN", "ACCOUNTANT"),
  requirePermission("invoice:post"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        arAccountId: z.string().uuid(),
        revenueAccountId: z.string().uuid(),
        cogsAccountId: z.string().uuid().optional(),
        inventoryAccountId: z.string().uuid().optional(),
        defaultOutputVatAccountId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const je = await postSvc.postSaleVoucherToGl(routeParam(req.params.voucherId), body, uid(req));
    res.status(201).json({
      postingStatus: "POSTED",
      sourceType: "SALE_VOUCHER",
      sourceId: routeParam(req.params.voucherId),
      journalEntry: je,
      message: "Sale voucher posted successfully.",
    });
  }),
);

financeRouter.post(
  "/post/purchase-voucher/:voucherId",
  requireRole("ADMIN", "ACCOUNTANT"),
  requirePermission("purchase_invoice:post"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        debitAccountId: z.string().uuid(),
        apAccountId: z.string().uuid(),
        defaultInputVatAccountId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const je = await postSvc.postPurchaseVoucherToGl(routeParam(req.params.voucherId), body, uid(req));
    res.status(201).json({
      postingStatus: "POSTED",
      sourceType: "PURCHASE_VOUCHER",
      sourceId: routeParam(req.params.voucherId),
      journalEntry: je,
      message: "Purchase voucher posted successfully.",
    });
  }),
);

financeRouter.post(
  "/post/income-outcome/:entryId",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        cashAccountId: z.string().uuid(),
        offsetAccountId: z.string().uuid(),
      })
      .parse(req.body);
    const je = await postSvc.postIncomeOutcomeToGl(routeParam(req.params.entryId), body, uid(req));
    res.status(201).json({
      postingStatus: "POSTED",
      sourceType: "INCOME_OUTCOME",
      sourceId: routeParam(req.params.entryId),
      journalEntry: je,
      message: "Income/outcome entry posted successfully.",
    });
  }),
);

financeRouter.get(
  "/audit-log",
  asyncHandler(async (req, res) => {
    const q = paginationQuerySchema
      .extend({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        userId: z.string().uuid().optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
      })
      .parse(req.query);
    res.json(
      await fin.listAuditLogs({
        ...q,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
      }),
    );
  }),
);

/* ERP analytics & treasury */
financeRouter.get(
  "/reports/statement-of-account",
  asyncHandler(async (req, res) => {
    const q = z
      .object({ partyId: z.string().uuid(), from: isoDate, to: isoDate })
      .parse(req.query);
    res.json(
      await analytics.statementOfAccount(
        q.partyId,
        new Date(q.from),
        new Date(q.to),
      ),
    );
  }),
);

financeRouter.get(
  "/reports/aging",
  asyncHandler(async (req, res) => {
    const q = z
      .object({ partyId: z.string().uuid(), asOf: isoDate.optional() })
      .parse(req.query);
    res.json(await analytics.agingReport(q.partyId, q.asOf ? new Date(q.asOf) : new Date()));
  }),
);

financeRouter.get(
  "/reports/income-statement",
  asyncHandler(async (req, res) => {
    const q = z.object({ from: isoDate, to: isoDate }).parse(req.query);
    res.json(await analytics.incomeStatement(new Date(q.from), new Date(q.to)));
  }),
);

financeRouter.get(
  "/reports/balance-sheet",
  asyncHandler(async (req, res) => {
    const q = z.object({ asOf: isoDate }).parse(req.query);
    res.json(await analytics.balanceSheet(new Date(q.asOf)));
  }),
);

financeRouter.get(
  "/reports/cash-flow",
  asyncHandler(async (req, res) => {
    const q = z.object({ from: isoDate, to: isoDate }).parse(req.query);
    res.json(await analytics.cashFlowApprox(new Date(q.from), new Date(q.to)));
  }),
);

financeRouter.get(
  "/reports/container-pnl/:containerId",
  asyncHandler(async (req, res) => {
    res.json(await analytics.containerProfitability(routeParam(req.params.containerId)));
  }),
);

financeRouter.get(
  "/dashboard/kpis",
  asyncHandler(async (_req, res) => {
    res.json(await analytics.dashboardKpis());
  }),
);

/* Cost centers */
financeRouter.get(
  "/cost-centers",
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.costCenter.findMany({ orderBy: { code: "asc" } }) });
  }),
);

financeRouter.post(
  "/cost-centers",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z.object({ code: z.string().min(1), name: z.string().min(1) }).parse(req.body);
    const row = await prisma.costCenter.create({
      data: { code: body.code.trim(), name: body.name.trim() },
    });
    res.status(201).json(row);
  }),
);

financeRouter.patch(
  "/cost-centers/:id",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() })
      .parse(req.body);
    const row = await prisma.costCenter.update({
      where: { id: routeParam(req.params.id) },
      data: body,
    });
    res.json(row);
  }),
);

/* System settings */
financeRouter.get(
  "/settings/:key",
  asyncHandler(async (req, res) => {
    const row = await prisma.systemSetting.findUnique({ where: { key: routeParam(req.params.key) } });
    res.json(row ?? { key: routeParam(req.params.key), value: null });
  }),
);

financeRouter.put(
  "/settings/:key",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const key = routeParam(req.params.key);
    const body = z.object({ value: z.unknown() }).parse(req.body);
    const row = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: body.value as object },
      update: { value: body.value as object },
    });
    res.json(row);
  }),
);

/* Cash & banks + treasury */
financeRouter.get(
  "/cash-banks",
  asyncHandler(async (_req, res) => {
    res.json({ items: await treasury.listCashBanks() });
  }),
);

financeRouter.post(
  "/cash-banks",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        kind: z.string().optional(),
        glAccountId: z.string().uuid().optional().nullable(),
      })
      .parse(req.body);
    const row = await treasury.createCashBank(body);
    res.status(201).json(row);
  }),
);

financeRouter.patch(
  "/cash-banks/:id",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        kind: z.string().optional(),
        glAccountId: z.string().uuid().optional().nullable(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(await treasury.updateCashBank(routeParam(req.params.id), body));
  }),
);

financeRouter.post(
  "/treasury/payments",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        paymentDate: isoDate,
        direction: z.enum(["RECEIPT", "DISBURSEMENT"]),
        partyId: z.string().uuid().optional().nullable(),
        cashBankId: z.string().uuid(),
        amount: z.union([z.number(), z.string()]),
        offsetAccountId: z.string().uuid(),
        notes: z.string().optional().nullable(),
        allocations: z
          .array(
            z.object({
              saleVoucherId: z.string().uuid().optional().nullable(),
              purchaseVoucherId: z.string().uuid().optional().nullable(),
              amount: z.union([z.number(), z.string()]),
            }),
          )
          .optional(),
      })
      .parse(req.body);
    const r = await treasury.createAndPostPayment({
      paymentDate: new Date(body.paymentDate),
      direction: body.direction,
      partyId: body.partyId,
      cashBankId: body.cashBankId,
      amount: body.amount,
      offsetAccountId: body.offsetAccountId,
      notes: body.notes,
      allocations: body.allocations,
      userId: uid(req),
    });
    res.status(201).json(r);
  }),
);

financeRouter.post(
  "/treasury/transfers",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        transferDate: isoDate,
        fromCashBankId: z.string().uuid(),
        toCashBankId: z.string().uuid(),
        amount: z.union([z.number(), z.string()]),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const r = await treasury.createAndPostTransfer({
      transferDate: new Date(body.transferDate),
      fromCashBankId: body.fromCashBankId,
      toCashBankId: body.toCashBankId,
      amount: body.amount,
      notes: body.notes,
      userId: uid(req),
    });
    res.status(201).json(r);
  }),
);

financeRouter.get(
  "/treasury/payments",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    res.json({ items: await treasury.listPayments() });
  }),
);

financeRouter.delete(
  "/accounts/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await fin.deleteGlAccount(routeParam(req.params.id), uid(req));
    res.status(204).send();
  }),
);

financeRouter.delete(
  "/fiscal-years/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await fin.deleteFiscalYear(routeParam(req.params.id), uid(req));
    res.status(204).send();
  }),
);

financeRouter.post(
  "/fiscal-years/:id/close",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        retainedEarningsAccountId: z.string().uuid(),
        closeDate: isoDate.optional(),
      })
      .parse(req.body);
    res.json(
      await fin.closeYear(
        routeParam(req.params.id),
        {
          retainedEarningsAccountId: body.retainedEarningsAccountId,
          closeDate: body.closeDate ? new Date(body.closeDate) : undefined,
        },
        uid(req),
      ),
    );
  }),
);

financeRouter.delete(
  "/cash-banks/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const linked = await prisma.treasuryPayment.count({ where: { cashBankId: id } });
    if (linked > 0) return res.status(409).json({ error: "لا يمكن حذف الصندوق/البنك لوجود سندات مرتبطة" });
    await prisma.cashBankAccount.delete({ where: { id } });
    res.status(204).send();
  }),
);

/* ----- Subledger reconciliation (AR/AP line matching) ----- */
financeRouter.get(
  "/reconciliation/open-lines",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        partyId: z.string().uuid(),
        accountId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
      })
      .parse(req.query);
    res.json({
      items: await recon.listOpenReconciliationLines({
        partyId: q.partyId,
        accountId: q.accountId,
        companyId: q.companyId,
      }),
    });
  }),
);

financeRouter.get(
  "/reconciliation/matches",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        partyId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
      })
      .parse(req.query);
    res.json({
      items: await recon.listReconciliationMatches({ partyId: q.partyId, companyId: q.companyId }),
    });
  }),
);

financeRouter.post(
  "/reconciliation/matches",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        debitJournalLineId: z.string().uuid(),
        creditJournalLineId: z.string().uuid(),
        amount: z.union([z.number(), z.string()]),
        matchType: z.nativeEnum(ReconciliationMatchType).optional(),
        note: z.string().optional().nullable(),
        companyId: z.string().uuid().optional().nullable(),
      })
      .parse(req.body);
    const row = await recon.createReconciliationMatch({
      debitJournalLineId: body.debitJournalLineId,
      creditJournalLineId: body.creditJournalLineId,
      amount: body.amount,
      matchType: body.matchType,
      note: body.note,
      companyId: body.companyId,
      userId: uid(req),
    });
    res.status(201).json(row);
  }),
);

financeRouter.post(
  "/reconciliation/matches/:id/reverse",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    res.json(await recon.reverseReconciliationMatch(id, uid(req)));
  }),
);

/* ----- Bank statement import & matching ----- */
financeRouter.post(
  "/bank-statements/import",
  asyncHandler(async (req, res) => {
    const lineSchema = z.object({
      txnDate: isoDate,
      amount: z.union([z.number(), z.string()]),
      description: z.string().optional().nullable(),
      bankReference: z.string().optional().nullable(),
      rawPayload: z.unknown().optional(),
    });
    const body = z
      .object({
        cashBankId: z.string().uuid(),
        companyId: z.string().uuid().optional().nullable(),
        sourceName: z.string().optional().nullable(),
        metadata: z.unknown().optional(),
        lines: z.array(lineSchema).min(1),
      })
      .parse(req.body);
    const stmt = await bankStmt.importBankStatement({
      cashBankId: body.cashBankId,
      companyId: body.companyId,
      sourceName: body.sourceName,
      metadata: body.metadata === undefined ? undefined : (body.metadata as Prisma.InputJsonValue),
      lines: body.lines.map((l) => ({
        txnDate: new Date(l.txnDate),
        amount: l.amount,
        description: l.description,
        bankReference: l.bankReference,
        rawPayload: l.rawPayload,
      })),
      userId: uid(req),
    });
    res.status(201).json(stmt);
  }),
);

financeRouter.get(
  "/bank-statements",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        cashBankId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
      })
      .parse(req.query);
    res.json({
      items: await bankStmt.listBankStatements({ cashBankId: q.cashBankId, companyId: q.companyId }),
    });
  }),
);

financeRouter.get(
  "/bank-statements/:id",
  asyncHandler(async (req, res) => {
    res.json(await bankStmt.getBankStatement(routeParam(req.params.id)));
  }),
);

financeRouter.get(
  "/bank-statements/:id/suggest-matches",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const tol = z.object({ tolDays: z.coerce.number().int().min(0).max(30).optional() }).parse(req.query);
    res.json(await bankStmt.suggestBankMatches(id, tol.tolDays ?? 3));
  }),
);

financeRouter.post(
  "/bank-statements/lines/:lineId/match-payment",
  asyncHandler(async (req, res) => {
    const lineId = routeParam(req.params.lineId);
    const body = z.object({ paymentId: z.string().uuid() }).parse(req.body);
    res.json(
      await bankStmt.matchStatementLineToPayment({
        statementLineId: lineId,
        paymentId: body.paymentId,
        userId: uid(req),
      }),
    );
  }),
);

financeRouter.post(
  "/bank-statements/lines/:lineId/unmatch",
  asyncHandler(async (req, res) => {
    await bankStmt.unmatchStatementLine(routeParam(req.params.lineId), uid(req));
    res.status(204).send();
  }),
);

financeRouter.post(
  "/bank-statements/lines/:lineId/ignore",
  asyncHandler(async (req, res) => {
    res.json(await bankStmt.setStatementLineIgnored(routeParam(req.params.lineId), uid(req)));
  }),
);

/* ----- FX revaluation (FX_REVALUATION journal) ----- */
financeRouter.post(
  "/fx-revaluation/preview",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        functionalCurrency: z.string().optional(),
        companyId: z.string().uuid().optional().nullable(),
        rateByCurrency: z.record(z.union([z.number(), z.string()])),
      })
      .parse(req.body);
    res.json({
      items: await fxRev.previewFxRevaluation({
        functionalCurrency: body.functionalCurrency,
        companyId: body.companyId,
        rateByCurrency: body.rateByCurrency,
      }),
    });
  }),
);

financeRouter.post(
  "/fx-revaluation/run",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        entryDate: isoDate,
        functionalCurrency: z.string().optional(),
        companyId: z.string().uuid().optional().nullable(),
        rateByCurrency: z.record(z.union([z.number(), z.string()])),
        fxGainAccountId: z.string().uuid(),
        fxLossAccountId: z.string().uuid(),
        description: z.string().optional(),
        sourceId: z.string().optional(),
      })
      .parse(req.body);
    const result = await fxRev.postFxRevaluationJournal({
      entryDate: new Date(body.entryDate),
      functionalCurrency: body.functionalCurrency,
      companyId: body.companyId,
      rateByCurrency: body.rateByCurrency,
      fxGainAccountId: body.fxGainAccountId,
      fxLossAccountId: body.fxLossAccountId,
      description: body.description,
      sourceId: body.sourceId,
      userId: uid(req),
    });
    res.status(201).json(result);
  }),
);

financeRouter.get(
  "/exchange-rates",
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.exchangeRateSnapshot.findMany({ orderBy: { asOf: "desc" } }) });
  }),
);

financeRouter.post(
  "/exchange-rates",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        label: z.string().min(1),
        rate: z.union([z.number(), z.string()]),
        asOf: isoDate.optional(),
      })
      .parse(req.body);
    const row = await prisma.exchangeRateSnapshot.create({
      data: {
        label: body.label.trim(),
        rate: new Prisma.Decimal(String(body.rate)),
        asOf: body.asOf ? new Date(body.asOf) : new Date(),
      },
    });
    res.status(201).json(row);
  }),
);

financeRouter.patch(
  "/exchange-rates/:id",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        label: z.string().min(1).optional(),
        rate: z.union([z.number(), z.string()]).optional(),
        asOf: isoDate.optional(),
      })
      .parse(req.body);
    const row = await prisma.exchangeRateSnapshot.update({
      where: { id: routeParam(req.params.id) },
      data: {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        ...(body.rate !== undefined ? { rate: new Prisma.Decimal(String(body.rate)) } : {}),
        ...(body.asOf !== undefined ? { asOf: new Date(body.asOf) } : {}),
      },
    });
    res.json(row);
  }),
);

financeRouter.delete(
  "/exchange-rates/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.exchangeRateSnapshot.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  }),
);

/** تقارير ضريبة القيمة المضافة — فترة حسب voucherDate للفواتير المُرحَّلة */
financeRouter.get(
  "/reports/vat/output",
  requireRole("ADMIN", "ACCOUNTANT"),
  requirePermission("finance:vat_report"),
  asyncHandler(async (req, res) => {
    const q = z.object({ from: isoDate, to: isoDate }).parse(req.query);
    res.json(await tax.vatOutputReport(new Date(q.from), new Date(q.to)));
  }),
);

financeRouter.get(
  "/reports/vat/input",
  requireRole("ADMIN", "ACCOUNTANT"),
  requirePermission("finance:vat_report"),
  asyncHandler(async (req, res) => {
    const q = z.object({ from: isoDate, to: isoDate }).parse(req.query);
    res.json(await tax.vatInputReport(new Date(q.from), new Date(q.to)));
  }),
);

financeRouter.get(
  "/reports/vat/summary",
  requireRole("ADMIN", "ACCOUNTANT"),
  requirePermission("finance:vat_report"),
  asyncHandler(async (req, res) => {
    const q = z.object({ from: isoDate, to: isoDate }).parse(req.query);
    res.json(await tax.vatPayableSummary(new Date(q.from), new Date(q.to)));
  }),
);
