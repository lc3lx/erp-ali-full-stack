# QA Staging Prep Baseline

## Audit Context
- Target: full ERP audit (frontend + backend + accounting integrity + usability)
- Environment target requested: staging-like realistic data
- Current executable evidence from repository: local lint/build/tests and static code audit

## Roles Matrix
- `ADMIN`: full governance actions (accounts, close/reopen, settings, deletes)
- `ACCOUNTANT`: posting, journals, reports, audit views, treasury operations
- `DATA_ENTRY`: operational documents (containers/vouchers/CRM) without core GL governance
- `STORE_KEEPER`: inventory-specific flows with restricted finance navigation

## Feature Inventory (Navigation Baseline)
Derived from `src/appNavConfig.js` and `src/App.jsx`:
- Hub and dashboard
- Operations and stock: containers, reports, customers, stores, items, warehouses, stock
- Purchasing/Sales: purchase vouchers, sale vouchers, suppliers
- Finance: GL, treasury, financial reports, accounting moves, income/outcome
- HR and CRM
- Official documents and system settings

## API Surface Baseline
Primary route groups under `backend/src/routes/`:
- auth, health
- containers, reports, parties, stores, items, inv-warehouses, inventory
- invoice-vouchers, invoice-sale, income-outcome, accounting-moves
- finance, hr, crm, official-documents

## Data/Seed Readiness Baseline
- Automated tests indicate partial seed mismatch for accounting test scenarios:
  - voucher accounting tests are skipped when required entities are missing
- Required staging seed minimum:
  - fiscal year + open periods
  - posting GL accounts across classes
  - customers/suppliers
  - at least one valid container and inventory context

## Entry Criteria for Full Staging Signoff
- Accessible staging URL and test credentials for all required roles
- Seed dataset that supports complete voucher -> posting -> reporting -> close scenarios
- Logging and audit visibility enabled during test window
