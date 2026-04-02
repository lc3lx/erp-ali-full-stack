# Quick Wins Implementation

## Implemented in this cycle
- Enforced production CORS safety by requiring `CORS_ORIGIN` in `backend/src/config/env.ts`.
- Scoped Swagger docs by environment in `backend/src/app.ts` and `backend/src/server.ts`.
- Added backend env template: `backend/.env.example`.
- Added backend lint/format toolchain:
  - `backend/eslint.config.js`
  - `backend/.prettierrc.json`
  - scripts in `backend/package.json`
- Added CI pipeline:
  - `.github/workflows/ci.yml` (frontend + backend lint/build/test).
- Expanded backend contract tests in `backend/test/app.test.ts`.
- Added readiness/live health checks in `backend/src/routes/health.ts`.
- Added graceful shutdown + Prisma disconnect in `backend/src/server.ts`.

## Validation commands
- Frontend: `npm run lint && npm run build`
- Backend: `npm run lint && npm run build && npm run test`

## Next Quick Wins
- Add dependency and secret scanning job in CI.
- Add endpoint-level latency histogram and error counters.
- Add one high-value finance route test with seeded fixtures.
