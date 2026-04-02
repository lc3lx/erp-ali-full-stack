# ERP Accounting Upgrade — Master Plan & Deliverables

This document is the single source for architecture, folder layout, migration, and scaling after the **Phase 1** code landing in the repo (Prisma extensions, `AccountingEngine`, payment allocation validation, API error envelope, VAT-aware invoice posting).

---

## 1. Current system (baseline analysis)

Already in production shape for a **vertical ERP slice**:

| Area | Implementation |
|------|----------------|
| Double-entry GL | `JournalEntry` + `JournalLine`, `createPostedJournal`, balanced in base currency |
| COA | `GlAccount` with `parentId` hierarchy |
| Fiscal | `FiscalYear`, `FiscalPeriod` (OPEN/CLOSED/LOCKED), `closeYear` → retained earnings |
| AR/AP subledger | Party on lines; invoices with `paid` / `remaining` / `balance`; treasury allocations |
| Inventory | `InvStockMove`, `InvStockBalance`, weighted-average recompute in `inventoryStockService` |
| Posting from docs | `documentPostingService` (sale / purchase / income-outcome) |
| Treasury | Payments + GL posting, allocations |

Gaps addressed in Phase 1 schema/code: **invoice workflow status**, **VAT master/lines**, **FIFO cost layers**, **budgets**, **RBAC matrix**, **notifications**, **approval requests**, **richer audit (before/after)**, **document attachments on invoices**, **FX/year-end journal source types**.

---

## 2. Target folder structure (backend)

```
backend/src/
  app.ts / server.ts          # bootstrap (unchanged entry)
  config/
  db/
  middleware/
  routes/                     # thin HTTP → controllers (gradual extract)
  controllers/                # NEW: parse req, call services, sendSuccess()
  services/                   # orchestration, transactions (existing)
  domain/
    accounting/
      AccountingEngine.ts     # double-entry builders + balance checks
      paymentAllocation.ts    # allocation rules
      types.ts
  repositories/               # Prisma isolation (expand per aggregate)
  core/
    http/
      apiResponse.ts          # { success, data, error } helpers
```

Frontend (target modular ERP shell):

```
src/
  app/
    layout/
      AppShell.jsx            # sidebar + topbar + outlet
      RoleNav.jsx
    components/
      data/   DataTable, Pagination, Filters
      forms/  FormField, ValidatedForm (Zod/RHF optional)
      feedback/ Modal, Toast, EmptyState, Skeleton
  features/
    sales/ purchases/ accounting/ inventory/ crm/
  lib/api.js                  # unwraps success envelope when present
```

---

## 3. Database schema improvements (Phase 1 — `schema.prisma`)

Implemented models/enums (run `npx prisma migrate dev` or `db push` after resolving migration history drift):

- `SourceDocumentStatus` on `SaleVoucher` / `PurchaseInvoiceVoucher`
- `TaxRate` + line `taxRateId`, `taxAmount`, `lineSubtotal` on sale/purchase lines
- `CostingMethod` on `Item`; `InvCostLayer` for **FIFO** (weighted average unchanged in service layer until FIFO consumer is written)
- `Budget` / `BudgetLine`
- `RolePermission` (`UserRole` × `AppModule` × action)
- `AppNotification`
- `ApprovalRequest`
- `AuditLog.before` / `after` JSON
- `SaleVoucherAttachment` / `PurchaseVoucherAttachment`
- `JournalSourceType`: `FX_REVALUATION`, `YEAR_END_CLOSE`

**Post-deploy SQL (data migration example):**

```sql
-- Map legacy posted invoices to workflow status POSTED
UPDATE "SaleVoucher" SET "documentStatus" = 'POSTED' WHERE "glJournalEntryId" IS NOT NULL;
UPDATE "PurchaseInvoiceVoucher" SET "documentStatus" = 'POSTED' WHERE "glJournalEntryId" IS NOT NULL;
-- Unposted stay DRAFT (adjust if business uses APPROVED without GL)
```

---

## 4. Core modules — implementation plan (phased)

| Phase | Module | Work |
|-------|--------|------|
| **1** ✅ | Accounting engine | Central builders: sale (AR/revenue/VAT/COGS), purchase (expense/inventory/AP/input VAT). `validatePaymentAllocations`. |
| **2** | Workflow | Enforce `DRAFT→SUBMITTED→APPROVED→POSTED`; block posting unless `APPROVED`; integrate `ApprovalRequest`. |
| **3** | VAT admin | CRUD `TaxRate`, VAT return reports (output vs input by period). |
| **4** | Multi-currency | Functional currency rules; `FX_REVALUATION` generator; unrealized/gain-loss accounts. |
| **5** | Inventory costing | FIFO consumer on `SALE_ISSUE` using `InvCostLayer`; stock valuation & movement ledger screens. |
| **6** | Reporting | Drill-down from TB/GL to source; comparative periods; budget vs actual using `BudgetLine`. |
| **7** | RBAC | Seed `RolePermission`; middleware `requirePermission(module, action)` composable with `requireRole`. |
| **8** | Notifications | Cron/worker: overdue AR/AP, low stock (`InvStockBalance` thresholds), pending approvals. |

---

## 5. Sample code references (in repo)

| Concern | Location |
|---------|----------|
| Accounting engine (builders + balance) | `backend/src/domain/accounting/AccountingEngine.ts` |
| Payment allocation validation | `backend/src/domain/accounting/paymentAllocation.ts` |
| Sale/purchase posting (uses engine, VAT-aware) | `backend/src/services/documentPostingService.ts` |
| GL posting primitive | `backend/src/services/financeService.ts` → `createPostedJournal` |
| API envelope helpers | `backend/src/core/http/apiResponse.ts` |
| Standard error JSON | `backend/src/middleware/errorHandler.ts` |
| Repository example | `backend/src/repositories/journalEntryRepository.ts` |

**Sale posting body extensions:**

- `defaultOutputVatAccountId` — if line has `taxAmount` but `TaxRate.outputVatAccountId` is null.
- Purchase: `defaultInputVatAccountId` — symmetric for input VAT.

---

## 6. API contract

Errors (all routes via `errorHandler`):

```json
{
  "success": false,
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "...", "details": {} }
}
```

Success (optional migration per route):

```json
{ "success": true, "data": { ... }, "error": null, "meta": { "page": 1, "total": 100 } }
```

Frontend `src/lib/api.js` unwraps `data` when `success === true`.

---

## 7. Step-by-step migration from current system

1. **Backup DB**; resolve Prisma migration drift (`prisma migrate resolve` / baseline / `db push` in dev only).
2. Apply new migration (or `prisma db push` in sandbox).
3. Run data SQL for `documentStatus` backfill (above).
4. Seed `TaxRate` rows and link GL output/input VAT accounts.
5. Deploy backend; smoke-test posting with zero tax (must match pre-upgrade numbers).
6. Add tax amounts on a **pilot** invoice; verify GL: AR = revenue + output VAT.
7. Enable `validatePaymentAllocations` in UAT (already in code) — fix any client sending invalid allocations.
8. Roll out UI envelope gradually using `sendSuccess()` on new controllers only.

---

## 8. Scaling & best practices

- **Transactions:** Keep one `prisma.$transaction` per business operation (post invoice + subledger + inventory).
- **Idempotency:** Posting already guarded by `glJournalEntryId` + `sourceType` uniqueness discipline; add idempotency keys on REST for payments.
- **Read models:** For heavy reporting, introduce materialized views or nightly aggregates (container P&amp;L, aging buckets).
- **Events (optional):** Outbox table for `InvoicePosted`, `PaymentAllocated` → async notifications/search.
- **Tenancy:** If multi-company is needed later, add `companyId` to all transactional tables and scope every query.

---

## 9. Immediate next engineering tasks

1. `taxService.ts` + `GET/POST /finance/tax-rates` with Zod.
2. Middleware `requirePermission` reading `RolePermission` cache.
3. FIFO issue logic in `inventoryStockService` when `Item.costingMethod === FIFO`.
4. Replace `App.jsx` monolith with `AppShell` + feature routes (React Router).
5. GitHub Action: `prisma validate` + `tsc` + `vitest` on PR.

This file should be updated as phases complete.
