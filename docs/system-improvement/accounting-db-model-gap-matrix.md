# Accounting DB Model Gap Matrix

## Scope
- `backend/prisma/schema.prisma`
- Accounting integrity constraints
- Missing enterprise accounting modules

## Schema Gap Matrix

| Priority | Area | Current State | Gap | Target Structure |
|---|---|---|---|---|
| P0 | Tax | No tax master/line model | Cannot produce robust VAT/GST accounting and returns | Add `TaxCode`, `TaxRate`, `TaxTransactionLine`, `TaxReturnPeriod` |
| P0 | Currency | Mixed free-text currency usage | Inconsistent currency normalization and rounding policy | Add canonical `Currency` table and FK usage; controlled precision metadata |
| P0 | FX provenance | `ExchangeRateSnapshot` exists but limited governance | No deterministic audit of FX source/version per posting | Add `FxRate` (source/effective window) and link postings/lines to chosen rate |
| P0 | Subledger controls | Party linkage optional on journal lines | Weak enforcement for AR/AP control account discipline | Add account policy fields (`requiresParty`, `subledgerType`) + validation rules |
| P1 | Period close metadata | Open/closed status exists | Missing close/reopen governance metadata | Add `closedAt`, `closedBy`, `reopenedAt`, `reopenedBy`, `reopenReason` |
| P1 | Approval metadata | No general approval entities | No maker-checker trail for sensitive accounting actions | Add approval workflow entities for journals, treasury, close actions |
| P1 | Reconciliation | Treasury allocations exist | No full bank reconciliation model | Add `BankStatement`, `BankStatementLine`, `BankReconciliationMatch` |
| P2 | Attachments | Domain-specific attachment only | Missing accounting evidence document linkage | Add generic `Attachment` model (`entityType`, `entityId`, metadata) |
| P2 | Integrity checks | Most invariants enforced at app level | Hard to guarantee consistency under future integrations | Add DB checks/indexes and migration-safe constraints where possible |
| P3 | Dimensions | Cost center exists | Limited multi-dimensional accounting analysis | Add generic dimensions model (`Dimension`, `DimensionValue`, `JournalLineDimension`) |

## Constraint Hardening Recommendations
- Enforce unique numbering scopes where business requires (document no + fiscal context).
- Add conditional integrity checks for accounting-sensitive relationships.
- Keep business-heavy validations in service layer, but backstop critical invariants with DB constraints.

## Migration Approach
1. Add new master tables (`Currency`, `TaxCode`, `FxRate`) in additive migrations.
2. Backfill and normalize existing currency/tax-sensitive records.
3. Introduce new FKs and soft-enforcement flags.
4. Enable strict enforcement after data cleanup and validation scripts pass.
