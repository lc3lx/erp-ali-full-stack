# Prioritized Accounting Remediation Backlog

## Delivery Model
- `Now` (P0): 1-2 sprints
- `Next` (P1): 2-5 sprints
- `Later` (P2-P3): continuous hardening

## Now (P0)

| ID | Work Item | Dependencies | Effort | Acceptance Criteria |
|---|---|---|---|---|
| P0-1 | Freeze posted documents (voucher/treasury/income-outcome) | none | M | Any update/delete on posted source returns controlled rejection |
| P0-2 | Enforce reversal-first correction policy | P0-1 | M | Posted effects corrected only via reversal-linked journals |
| P0-3 | Treasury allocation integrity checks | none | M | Allocation sums and ownership validations enforced |
| P0-4 | Trial balance parity gate after posting | none | S | Posting flow fails if period trial-balance parity is violated |
| P0-5 | Accounting role policy alignment | none | S | All accounting-impact routes guarded consistently |

## Next (P1)

| ID | Work Item | Dependencies | Effort | Acceptance Criteria |
|---|---|---|---|---|
| P1-1 | Close cockpit (period/year checklist + blockers) | P0-5 | L | Close cannot proceed unless all mandatory checks pass |
| P1-2 | Reopen governance with audit reason | P1-1 | M | Reopen action requires reason and privileged approval |
| P1-3 | Approval workflow (maker-checker) | P0-1 | L | Sensitive actions require submit/approve sequence |
| P1-4 | Reporting UX upgrade for accountant workflows | none | M | Report pages support guided filters and structured tables |
| P1-5 | Open-item AR/AP settlement engine improvements | P0-3 | L | Aging and balances reconcile by document settlement state |

## Later (P2-P3)

| ID | Work Item | Dependencies | Effort | Acceptance Criteria |
|---|---|---|---|---|
| P2-1 | Canonical currency + FX provenance model | P1-5 | L | All postings trace to normalized currency and deterministic FX source |
| P2-2 | Tax engine schema and posting integration | P2-1 | XL | Tax lines and returns reconcile with GL |
| P2-3 | Generic attachments and audit evidence package | P1-3 | M | Financial entities support auditable evidence attachments |
| P2-4 | Multi-dimension accounting model | P1-4 | L | Journal lines support standardized reporting dimensions |
| P3-1 | DB-level invariants hardening | P0-1, P2-1 | L | Critical accounting invariants protected at data layer |

## Delivery Sequence Notes
- Do not begin tax/currency deep expansions before P0 document integrity controls are complete.
- UX improvements should ship incrementally but align with workflow controls (approval and close states).
- Run assurance checklist at the end of each sprint touching accounting logic.
