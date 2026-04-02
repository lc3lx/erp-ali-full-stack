# Operations and Security Hardening Plan

## Implemented baseline
- Backend container artifacts:
  - `backend/Dockerfile`
  - `backend/.dockerignore`
- Runtime health model:
  - `/health/live` for process liveness
  - `/health/ready` for DB readiness
- Graceful shutdown on `SIGINT`/`SIGTERM` with Prisma disconnect.
- Request ID included in HTTP logs via morgan formatting.

## Remaining hardening backlog

### Priority 1
- Add production compose profile with backend + db + restart policy.
- Add non-root user and immutable filesystem policy for runtime container.
- Add CI security checks (secret scanning, dependency audit).

### Priority 2
- Add structured JSON logger wrapper (timestamp, level, requestId, route, latency).
- Add metrics (`/metrics`) and tracing starter (OpenTelemetry).
- Add backup/restore scripts and scheduled verification.

### Priority 3
- Add IaC baseline for production environment.
- Write runbooks: deploy, rollback, incident response, and DB restore.
