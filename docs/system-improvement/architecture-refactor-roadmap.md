# Architecture Refactor Roadmap

## Backend modularization (`finance`)

### Phase A (Week 1)
- Create feature folders:
  - `backend/src/features/finance/accounts/`
  - `backend/src/features/finance/journals/`
  - `backend/src/features/finance/fiscal/`
  - `backend/src/features/finance/reporting/`
- Move Zod schemas into per-feature `schemas.ts`.
- Keep public route contract unchanged.

### Phase B (Week 2)
- Split `routes/finance.ts` into smaller routers and mount under same prefix.
- Introduce service interfaces and move Prisma calls out of route handlers.
- Add unit tests per service module.

### Phase C (Week 3-4)
- Add shared repository/data-access layer for transaction boundaries.
- Remove direct Prisma access from finance routes entirely.
- Add contract tests for key financial workflows.

## Frontend modularization (`ContainerListPage`, `FinanceManagementPage`)

### Phase A (Week 1)
- Extract data hooks:
  - `src/hooks/useContainers.js`
  - `src/hooks/useFinanceDashboard.js`
- Move API calls out of page components.

### Phase B (Week 2)
- Split page into presentational subcomponents under `src/components/finance/*` and `src/components/containers/*`.
- Keep behavior stable with existing props/state shape.

### Phase C (Week 3)
- Introduce route-level lazy loading and page-level boundaries.
- Add component tests for extracted hooks/components.

## Milestones
- M1: no file > 400 lines in finance backend paths.
- M2: no direct Prisma call in route handlers for finance features.
- M3: frontend mega-pages reduced by at least 50% LOC.
