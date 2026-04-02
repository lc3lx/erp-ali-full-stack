# Accounting Integrity Audit

## Objective
Validate that the system behaves as an accounting-first platform with trial-balance parity as a release gate.

## Release Checks
- [x] Voucher posting is non-repeatable (idempotent guard + source linkage).
- [x] Posting endpoints return explicit posting status and user-facing message.
- [x] Trial balance summary endpoint is available for quick parity checks.
- [x] Income statement and balance sheet remain ledger-driven.
- [x] Aging report now derives from posted party journal lines.
- [x] Audit logs are written for posting actions.

## Operational Validation
- Run `npm run lint` in `backend/`
- Run `npm run build` in `backend/`
- Run `npm run test` in `backend/`

## Accounting Acceptance Gate
Release is blocked if any of the following fails:
- Trial balance summary reports `isBalanced=false` for active period.
- A voucher can be posted more than once.
- Financial report totals diverge from ledger-derived balances.
