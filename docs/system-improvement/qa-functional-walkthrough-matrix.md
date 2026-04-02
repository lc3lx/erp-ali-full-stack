# Full Functional Walkthrough Matrix

## Execution Method
- Static full-page/page-action audit from frontend and backend route contracts
- Automated checks executed:
  - frontend lint/build
  - backend lint/test
- Staging live walkthrough remains pending for browser-level confirmation

## Coverage Matrix by Module

| Module | Page/API Coverage | Positive | Negative | Boundary | Status |
|---|---|---|---|---|---|
| Authentication | `LoginView`, `/api/v1/auth/*` | login ok path | invalid payload -> validation error | rate-limited auth path present | Partial pass (needs staging brute-force/user-lock test) |
| Containers & Operations | `ContainerListPage`, `/containers`, `/reports` | list/read flows | unauthorized access covered | pagination/query paths exist | Partial pass |
| Master Data | customers/stores/items/warehouses/suppliers pages + routes | CRUD baseline present | auth checks applied at app router | long-list filtering depends on staging data | Partial pass |
| Purchase Vouchers | `InvoiceVouchersPage`, `/invoice-vouchers` | create + line + totals + post | repost reject tested | decimal input normalization improved | Pass in automated scope; staging UX pending |
| Sale Vouchers | `InvoiceSalePage`, `/invoice-sale` | create + line + totals + post | repost reject tested | decimal input normalization improved | Pass in automated scope; staging UX pending |
| GL Core | `FinanceManagementPage`, `/finance/journal-entries` | draft/create/post flows | invalid lines rejected | TB/ledger date boundaries handled by parse checks | Partial pass |
| Treasury | `TreasuryPage`, `/finance/treasury/*` | basic flow present | advanced allocation validation still risk area | high-volume batch boundaries unverified | At risk |
| Financial Reports | `FinancialReportsPage`, `/finance/reports/*` | endpoint availability | missing guided inputs in UX | report performance at scale unverified | At risk |
| HR/CRM | `HrPage`, `CrmPage`, routes | endpoints and pages exist | role controls present | deep domain edge cases not fully covered | Partial pass |
| Official/System | `OfficialDocumentsPage`, `SystemSettingsPage` | baseline operations exist | privileged actions role-restricted | governance/audit richness needs strengthening | Partial pass |

## Automated Runtime Evidence
- Frontend lint: no errors (1 warning in `AuthContext`)
- Frontend build: success
- Backend lint: no errors (warnings only)
- Backend tests: pass with partial skips due to missing accounting seed entities

## Functional Defect Candidates Found During Walkthrough
- Accounting-adjacent route access consistency needs hardening.
- Some finance UX paths still rely on manual/technical inputs.
- Treasury and reconciliation depth is below enterprise readiness.
