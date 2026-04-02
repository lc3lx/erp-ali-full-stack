# Baseline Audit

## Scope
- Frontend: `src/`
- Backend API: `backend/src/`
- Data model: `backend/prisma/schema.prisma`
- Ops artifacts: `backend/docker-compose.yml`, env files, scripts

## Current Baseline
- Architecture: monorepo with React/Vite frontend and Express/Prisma backend.
- DB runtime: PostgreSQL via docker compose (DB only).
- Health checks: `/health` existed; live/readiness added in this implementation cycle.
- CI: missing before this cycle; GitHub Actions CI added.
- Backend quality gates: missing before this cycle; ESLint + Prettier added.
- Tests: minimal integration tests existed; auth/error contract tests expanded.

## Key Hotspots
- Large backend files in finance routes/services with high coupling.
- Large frontend pages (`ContainerListPage`, `FinanceManagementPage`) mixing state, API, and UI concerns.
- Direct/manual operational steps with no production deployment artifact.

## Baseline KPIs (to track weekly)
- API `5xx` rate by endpoint.
- API p95 latency on top 10 endpoints.
- Backend test pass rate and runtime.
- Number of lint issues per PR.
- Mean time to recover from production incidents.
