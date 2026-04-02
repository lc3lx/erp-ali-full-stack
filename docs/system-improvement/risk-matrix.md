# Risk Matrix (P0-P3)

| Priority | Category | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|---|
| P0 | Security | Permissive CORS defaults in production | High | Medium | Require explicit `CORS_ORIGIN` in production and fail startup if missing |
| P0 | Security | Public API docs in production | Medium | Medium | Disable Swagger in prod unless explicitly enabled |
| P0 | Reliability | No CI gating for lint/build/test | High | High | Add GitHub Actions CI for frontend and backend |
| P1 | Maintainability | Backend has no lint/format governance | Medium | High | Add backend ESLint/Prettier and enforce in CI |
| P1 | Reliability | No readiness check against DB | High | Medium | Add `/health/ready` with DB ping |
| P1 | Operations | No graceful shutdown lifecycle | Medium | Medium | Add SIGINT/SIGTERM handling and Prisma disconnect |
| P2 | Performance | Report/inventory queries may degrade at scale | High | Medium | Profile heavy endpoints and apply query/index tuning |
| P2 | Maintainability | Large route/service/page files create change risk | Medium | High | Modularize by feature and extract hooks/components |
| P3 | Operations | Missing IaC and runbooks | Medium | Medium | Introduce IaC and operational documentation |

## Ownership Suggestion
- P0/P1: backend lead + DevOps support.
- P2: backend + frontend feature owners.
- P3: platform/operations track.
