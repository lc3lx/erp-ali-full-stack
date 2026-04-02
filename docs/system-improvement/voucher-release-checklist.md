# Voucher Accounting Release Checklist

## Scope
- Purchase vouchers: `/api/v1/invoice-vouchers`
- Sales vouchers: `/api/v1/invoice-sale`
- GL posting: `/api/v1/finance/post/*`

## Checklist
- [x] Voucher totals are derived from voucher lines (not trusted from client header fields).
- [x] Posting rejects duplicate post attempts for same voucher.
- [x] Posting writes audit log records for voucher posting actions.
- [x] Currency posting path validates exchange-rate availability when needed.
- [x] Integration tests cover create -> line add -> totals -> post -> repost reject.

## Verification Run
- Backend lint: `npm run lint`
- Backend build: `npm run build`
- Backend tests: `npm run test`

## Notes
- Financial posting correctness still depends on seed account mapping quality in non-dev environments.
- Before production cutover, validate that AR/AP/revenue/expense account selection aligns with accounting policy.
