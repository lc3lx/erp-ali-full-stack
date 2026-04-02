# Phase 2 — Core ERP behavior (integration guide)

## What was delivered

### 1. Workflow engine (`backend/src/services/workflowService.ts`)

- **States:** `DRAFT` → `SUBMITTED` (pending approval) → `APPROVED` → `POSTED` (after GL) → `PAID` (when balance/remaining settled).
- **Service guards:** `assertCanEditSaleVoucher` / `assertCanEditPurchaseVoucher` (only **DRAFT**), `assertCanPost*` (only **APPROVED** and not yet posted), `assertCanDelete*`.
- **Approval:** `submit*ForApproval`, `approve*`, `reject*` using `ApprovalRequest`.
- **Posting:** `documentPostingService` sets `documentStatus` to **POSTED** when GL is linked.
- **Treasury:** `recalcVoucherAllocationTotals` calls `markSaleVoucherPaidIfSettled` / `markPurchaseVoucherPaidIfSettled` inside the same transaction.

**API (authenticated):**

- `POST /api/v1/invoice-sale/:id/workflow/submit`
- `POST /api/v1/invoice-sale/:id/workflow/approve` body: `{ comment?: string }`
- `POST /api/v1/invoice-sale/:id/workflow/reject`
- Same paths under `/api/v1/invoice-vouchers/...`

### 2. FIFO (`backend/src/services/inventoryStockService.ts`)

- **`consumeFIFO(tx, warehouseId, itemId, qty)`** — oldest `InvCostLayer` first; updates `qtyRemaining`.
- **Receipts / transfers in / positive adjustments:** create a matching `InvCostLayer` when `Item.costingMethod === FIFO`.
- **`rebuildFifoLayersFromHistory`** — replays all `InvStockMove` rows after deletes (e.g. repost sale) to restore layer correctness.
- **Weighted average** unchanged when `costingMethod === WEIGHTED_AVERAGE`.

### 3. VAT (`backend/src/services/taxService.ts`)

- `calculateVatForLine({ lineNet, ratePercent, isInclusive })`
- Reports (posted vouchers, date range on `voucherDate`):
  - `GET /api/v1/finance/reports/vat/output?from=&to=`
  - `GET /api/v1/finance/reports/vat/input?from=&to=`
  - `GET /api/v1/finance/reports/vat/summary?from=&to=`

### 4. Permissions (`backend/src/middleware/requirePermission.ts`, `domain/permissions/registry.ts`)

- Keys like `invoice:post`, `purchase_invoice:approve`, `finance:vat_report`, `notifications:read`.
- **ADMIN** bypasses checks.
- If **`RolePermission` table is empty**, all authenticated users pass (bootstrap). After `prisma/seed.ts` runs, rules apply.

### 5. Notifications (`backend/src/services/notificationService.ts`, `routes/notifications.ts`)

- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`
- Submit workflow notifies users with roles **ADMIN** and **ACCOUNTANT**.

### 6. Frontend

- **`src/app/layout/AppShell.jsx`** — topbar + sidebar + `NotificationsDropdown` for ERP roles.
- **`DocumentStatusBadge`**, workflow buttons on **Invoice Sale** and **Invoice Vouchers** pages.
- **`GlSaleVoucherPost` / `GlPurchaseVoucherPost`** require **APPROVED** before showing posting UI (posted invoices still show success state).

---

## Database migration (existing data)

After applying Prisma schema (including `PAID` on `SourceDocumentStatus`):

```sql
UPDATE "SaleVoucher"
SET "documentStatus" = 'POSTED'
WHERE "glJournalEntryId" IS NOT NULL;

UPDATE "PurchaseInvoiceVoucher"
SET "documentStatus" = 'POSTED'
WHERE "glJournalEntryId" IS NOT NULL;
```

Unposted invoices remain **DRAFT** and must go through **submit → approve** before `POST /finance/post/...`.

---

## Step-by-step rollout

1. Backup PostgreSQL.
2. `npx prisma migrate dev` or `db push` (your environment).
3. Run SQL above for legacy posted documents.
4. `npx prisma db seed` — creates `RolePermission` rows (skip if `RolePermission` already populated).
5. Restart API; verify **DATA_ENTRY** can submit, **ACCOUNTANT** can approve and post.
6. Set `Item.costingMethod` to **FIFO** only for items that should use layers (optional).

---

## Folder reference

```
backend/src/
  services/
    workflowService.ts
    notificationService.ts
    taxService.ts
  domain/permissions/registry.ts
  middleware/requirePermission.ts
  routes/notifications.ts
frontend/src/
  app/layout/AppShell.jsx
  components/erp/DocumentStatusBadge.jsx
  components/erp/NotificationsDropdown.jsx
```
