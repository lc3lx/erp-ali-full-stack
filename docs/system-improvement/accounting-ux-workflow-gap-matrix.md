# Accounting UX and Workflow Gap Matrix

## Objective
Identify UX and operational workflow gaps that block accountant-grade daily usage.

## Gap Matrix (Product / UX)

| Priority | Workflow Area | Current Behavior | Gap | Recommended Improvement |
|---|---|---|---|---|
| P0 | Posting governance | Single-step posting in sensitive flows | No maker-checker lifecycle | Add statuses: `DRAFT -> SUBMITTED -> APPROVED -> POSTED -> REVERSED` |
| P0 | Period close operations | Backend supports period/year close endpoints | UI control surface for close governance is limited | Add close cockpit with blockers, approvals, and reopen with reason |
| P1 | Reporting usability | Some reports require raw IDs/manual input | Not practical for accounting operations | Add guided selectors (party, account, container), presets, and filters |
| P1 | Financial report readability | Raw JSON-like outputs in key flows | Weak accountant UX for review and sign-off | Build tabular views with totals, variance badges, and drill-down links |
| P1 | Voucher editing | Prompt-style edit patterns still exist in some pages | High data-entry error probability | Replace with validated form/grid editing with inline numeric checks |
| P2 | Error explanations | Technical errors reach users in mixed style | Poor operational clarity | Standardize accounting error catalog and human-readable remediation hints |
| P2 | Posting visibility | Inconsistent posting status feedback across screens | Users cannot quickly trust document accounting state | Show unified badges and timeline events on each financial document |
| P3 | Audit discoverability | Audit data exists but review workflows are basic | Hard for finance leads to perform control reviews | Add audit filters by action/entity/date/user with export snapshots |

## UX Acceptance Criteria
- Accountants can complete month-end without raw UUID entry.
- Every posted financial document shows immutable posting metadata.
- Close process screen blocks closure when any prerequisite control fails.
- Report pages support export-ready tables with clear totals and subtotals.
