# Accounting Assurance Checklist

## Release Gate
All items in this checklist are mandatory for accounting-impact releases.

## 1) Trial Balance Integrity
- [ ] `Trial Balance Summary` shows `isBalanced=true` for active period.
- [ ] Total debit equals total credit within accepted precision.
- [ ] No post flow can bypass parity validation.

## 2) Posting Controls
- [ ] Posted source documents are immutable (except controlled reversal flow).
- [ ] Re-post attempts are rejected with deterministic error responses.
- [ ] Posting response includes clear status metadata (`POSTED`/source info).

## 3) Statement Tie-Out
- [ ] Income statement totals reconcile to ledger-derived balances.
- [ ] Balance sheet totals reconcile to ledger-derived balances.
- [ ] AR/AP aging logic matches open settlement behavior policy.

## 4) Period Governance
- [ ] Posting into closed period is blocked.
- [ ] Close/reopen actions are audited with actor, time, and reason.
- [ ] Period close checklist is completed and archived.

## 5) Audit Trail Completeness
- [ ] All financial create/update/delete/post/void actions are audited.
- [ ] Audit entries include entity type, entity id, action, user, and timestamp.
- [ ] High-risk actions provide before/after context where applicable.

## 6) Security and Access
- [ ] Accounting-impact endpoints require aligned finance roles.
- [ ] Sensitive settings changes require privileged role and are auditable.

## 7) Test Evidence
- [ ] Automated tests cover posting success + repost rejection.
- [ ] Tests cover negative scenarios (invalid allocations, period lock, missing data).
- [ ] Test report is attached to release record.

## Sign-off
- Finance Owner: __________________
- Engineering Owner: __________________
- Release Date: __________________
