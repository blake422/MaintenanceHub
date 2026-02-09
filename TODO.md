# MaintenanceHub - Engineering Remediation Checklist

This document tracks the work required to make MaintenanceHub production-ready.

---

## Critical (Must Fix Before Production)

### Security

- [x] **Add rate limiting to auth endpoints**
  - Install `express-rate-limit`
  - Protect: `/api/auth/validate-access-key`, `/api/auth/forgot-password`, `/api/auth/request-access`, `/api/auth/register`
  - Also protected: `/api/auth/login`, `/api/auth/reset-password`
  - Configured: 5 requests/minute per IP

- [x] ~~**Secure webhook endpoint**~~ - Requires client's Stripe access (out of scope)

- [x] ~~**Fix Stripe secret key**~~ - Client will handle

### Monitoring

- [x] ~~**Add structured logging**~~ - Client will handle

---

## High Priority

### Input Validation

- [ ] **Add Zod validation to all endpoints**
  - Current: ~21 endpoints validated out of 100+
  - Priority endpoints:
    - [ ] `POST /api/auth/switch-role` (line ~80)
    - [ ] `PUT /api/companies/:id/package` (line ~468)
    - [ ] `POST /api/invitations`
    - [ ] All equipment import endpoints
  - [ ] Validate AI-extracted data before database insertion

### Database

- [ ] **Increase connection pool size**
  - File: `server/db.ts`
  - Change `max: 5` to `max: 20` for production

- [ ] **Fix N+1 query patterns**
  - [ ] `GET /api/invitations` for platform admin (lines ~1228-1235) - loops through companies
  - [ ] Parts duplicate check during import (lines ~1735-1742)
  - [ ] Technician workload calculation (lines ~863-884)

- [ ] **Add database indexes**
  - [ ] `equipment.companyId`
  - [ ] `work_orders.companyId`
  - [ ] `users.companyId`
  - [ ] `users.email`

- [ ] **Wrap bulk operations in transactions**
  - Equipment import should rollback on partial failure

### Logging

- [ ] **Replace console.log with structured logging**
  - Install Winston or Pino
  - Add context: userId, companyId, requestId
  - Configure log levels by environment
  - Current: 256 console.log/error/warn calls in server/

---

## Medium Priority

### Code Organization

- [x] **Split routes.ts into modules**
  - Current: 4,797 lines in single file
  - Suggested structure:
    ```
    server/routes/
      auth.routes.ts
      equipment.routes.ts
      workOrders.routes.ts
      users.routes.ts
      billing.routes.ts
      admin.routes.ts
      integrations.routes.ts
    ```

- [ ] **Extract business logic to services**
  - Move logic out of route handlers
  - Create: `equipmentService.ts`, `billingService.ts`, etc.

### Type Safety

- [ ] **Remove `any` types**
  - Current: 921 instances across codebase
  - Priority files:
    - [ ] `server/routes.ts` (108 instances)
    - [ ] `server/storage.ts`
    - [ ] `server/aiService.ts`

- [ ] **Enable TypeScript strict mode**
  - Update `tsconfig.json`
  - Fix resulting type errors

### Error Handling

- [ ] **Create centralized error handler middleware**
  - Consistent error response format
  - Proper HTTP status codes
  - Error logging integration

---

## Low Priority (Post-Launch)

### Performance

- [ ] **Add caching layer**
  - Redis or in-memory cache for frequently accessed data
  - Cache company settings, user permissions

- [ ] **Optimize equipment import**
  - Batch database inserts
  - Progress streaming to client

### DevOps

- [ ] **Add health check endpoint**
  - `GET /health` - returns DB connection status, memory usage

- [ ] **Create Docker configuration**
  - Dockerfile for containerized deployment
  - docker-compose for local development

### Documentation

- [x] **Create .env.example** - Done
- [ ] **Add API documentation**
  - OpenAPI/Swagger spec
  - Or at minimum, document key endpoints

---

## Completed

- [x] Create `.env.example` file
- [x] Create `.env` file with secrets
- [x] Add `.env` to `.gitignore`
- [x] Fix `npm run dev` for local development (added `--env-file` flag)
- [x] Ensure Replit deployment compatibility

---

## Notes

### Environment Setup

Local development requires `.env` file. Replit uses injected Secrets.

```bash
# Local development
npm run dev    # Uses --env-file=.env

# Production (Replit)
npm run start  # Uses system environment variables
```

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `server/routes.ts` | 4,797 | All API endpoints (needs splitting) |
| `server/storage.ts` | ~2,000 | Database abstraction layer |
| `server/aiService.ts` | ~2,500 | OpenAI integration |
| `shared/schema.ts` | ~1,400 | Database schema + types |

### Estimated Effort

| Priority | Items | Status |
|----------|-------|--------|
| Critical | 2 remaining | Rate limiting, logging |
| High | 10 | Validation, database, logging |
| Medium | 6 | Code organization, type safety |
| Low | 5 | Ongoing |

### Out of Scope

- Testing framework setup (client decision)
- Webhook HMAC verification (requires client's Stripe access)
- Stripe secret key (client will handle)

---

*Last updated: 2025-12-25*
