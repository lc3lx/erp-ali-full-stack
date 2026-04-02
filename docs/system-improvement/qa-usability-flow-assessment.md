# Usability and Flow Assessment

## Personas
- Accountant (GL, journals, reports, close operations)
- Operations/Data Entry (vouchers, stock, parties)
- Admin (governance, settings, approvals)

## Usability Findings

| Priority | Area | Finding | User Impact | Recommendation |
|---|---|---|---|---|
| P0 | Close governance UX | Period/year close controls not presented as guided cockpit | High risk of incorrect close execution | Add close dashboard with blockers and checklist gates |
| P1 | Reports UX | Some report flows rely on technical IDs/manual style inputs | Slower execution and higher input error rate | Replace with guided selectors and lookup-assisted filters |
| P1 | Posting feedback | Posting status visibility not uniformly surfaced across all modules | Users cannot quickly trust accounting state | Show unified lifecycle badges and posting timeline |
| P1 | Data entry consistency | Legacy prompt-style editing patterns still appear in voucher-like interactions | Human error risk in accounting-sensitive fields | Move all edits to validated inline forms/grids |
| P2 | Audit discoverability | Audit stream exists but review workflow is basic | Difficult internal control review | Add saved views and export snapshots for audits |
| P2 | Role-oriented navigation | Navigation is broad and role-specific hiding is partial | Cognitive overload for non-admin users | Build role-focused default landing pages and action shortcuts |

## Flow Quality Verdict
- **Operationally usable** for basic flows.
- **Not yet world-class** for accountant-heavy workflows due to governance visibility and advanced report ergonomics.

## UX Acceptance Gates (Recommended)
- No accountant-critical path depends on raw IDs.
- Each posting action yields explicit, consistent status and next-step hints.
- Close and reopen actions are guided and cannot proceed with unresolved blockers.
- High-risk actions always show clear confirmation context and impact summary.
