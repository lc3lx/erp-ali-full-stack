# Accounting Logic Gap Matrix

## Scope
- Posting and journal controls
- Voucher lifecycle integrity
- Treasury and subledger consistency
- Period close behavior

## Gap Matrix (Logic / Controls)

| Priority | Gap | Current Evidence | Risk | Recommended Fix |
|---|---|---|---|---|
| P0 | Posted source documents can still be mutated in some flows | `backend/src/services/saleVoucherService.ts`, `backend/src/services/purchaseVoucherService.ts`, `backend/src/services/incomeOutcomeService.ts` | Subledger/GL drift | Enforce strict immutability once `glJournalEntryId` exists; allow only reversal/correction workflows |
| P0 | Void flow can weaken accounting history if used as destructive correction | `backend/src/services/financeService.ts` (`voidJournalEntry`) | Audit and historical parity risk | Introduce explicit reversal journal policy with linkage to original entry |
| P0 | Treasury allocation validations are incomplete | `backend/src/services/treasuryService.ts` | Misstated AR/AP and unmatched settlements | Enforce allocation sum checks, party consistency, voucher status checks |
| P1 | Accounting-adjacent routes have inconsistent authorization depth | `backend/src/app.ts`, `backend/src/routes/income-outcome.ts`, `backend/src/routes/accounting-moves.ts` | Unauthorized accounting changes | Align all accounting-impact routes with finance role policy |
| P1 | Period close controls are present but not complete as governance workflow | `backend/src/services/financeService.ts`, `backend/src/routes/finance.ts` | Close process bypass risk | Add close checklist gates and controlled reopen process |
| P1 | AR/AP aging logic can diverge from open-item truth if not document-netted | `backend/src/services/erpAnalyticsService.ts` | Collection/payment decisions based on noisy balances | Move to open-item settlement model by document and due date |
| P2 | Audit coverage is uneven across document CRUD actions | service-level gaps across voucher/treasury updates | Incomplete investigation trail | Standardize audit logs for all financial create/update/delete/post/void actions |
| P2 | Inventory valuation edge cases with backdated moves | `backend/src/services/inventoryStockService.ts` | COGS and stock valuation mismatch | Add historical costing strategy and backdated recompute policy |
| P3 | Legacy accounting-moves path overlaps with GL concerns | `backend/src/services/accountingService.ts` | Parallel accounting behavior | Either fold into GL-governed flows or isolate as non-ledger analytics |

## Immediate Control Set (First 2 Weeks)
- Freeze posted vouchers and treasury docs.
- Disallow destructive correction paths for posted accounting effects.
- Add hard validation for treasury allocations and voucher ownership linkage.
- Add security parity for all accounting-impact routes.
