# Defect Log and Readiness Signoff

## Defect Log (Prioritized)

| ID | Severity | Category | Finding | Repro Summary | Proposed Fix |
|---|---|---|---|---|---|
| DEF-001 | P0 | Governance/Accounting | Posted-document immutability is not uniformly guaranteed across all accounting-impact entities | Post document -> attempt update/delete through non-hardened path | Enforce centralized posted-state guard in all service mutations |
| DEF-002 | P0 | Control Framework | Close/reopen governance UX is incomplete for production-grade month-end controls | Attempt period close process from UI lacks full blocker cockpit | Build close management workflow with blocking checks and approvals |
| DEF-003 | P1 | Treasury Integrity | Treasury settlement/reconciliation controls not yet enterprise-complete | Create allocations with edge mismatches | Add strict allocation validations and reconciliation model depth |
| DEF-004 | P1 | Reporting UX | Accountant reports require technical/manual input patterns in key flows | Navigate reports, attempt party-driven analysis | Add lookup-driven filters and guided report forms |
| DEF-005 | P1 | Access Policy | Accounting-adjacent authorization consistency needs tighter alignment | Compare finance and non-finance route restrictions | Apply unified role policy for all accounting-impact routes |
| DEF-006 | P2 | Test Coverage | End-to-end accounting tests partially skipped without full realistic seed | Run backend tests with current seed | Add mandatory staging seed pack and non-skippable critical accounting suite |

## Retest Summary
- Frontend lint: pass with one non-blocking warning.
- Frontend build: pass.
- Backend lint: pass with warnings only.
- Backend tests: pass; critical accounting scenarios partly skipped due seed incompleteness.

## Go/No-Go Recommendation
- **Current decision: CONDITIONAL NO-GO for “world-class global standard” release**
  - Reason: unresolved P0 governance gaps and incomplete staging realism coverage.
- **Conditional GO** is possible after:
  1. Closing P0 defects (immutability + close governance controls),
  2. Executing full staging run with realistic seed and complete non-skipped accounting tests,
  3. Passing assurance checklist without exceptions.

## Signoff Template
- QA Lead: __________________
- Finance Controller: __________________
- Engineering Lead: __________________
- Date: __________________
