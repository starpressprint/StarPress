# Star Press — E-commerce Website


E-commerce web app for Star Press, a local printing business. Built phase-by-phase;
see `docs/` for the full project documentation — start with `docs/00-PROJECT-OVERVIEW.md`.

## Quick links
- [Project Overview](docs/00-PROJECT-OVERVIEW.md)
- [Architecture](docs/01-ARCHITECTURE.md)
- [Database Schema](docs/02-DATABASE-SCHEMA.md)
- [API Reference](docs/03-API-REFERENCE.md)
- [Pages & Features Tracker](docs/04-PAGES-AND-FEATURES.md)
- [Changelog](docs/05-CHANGELOG.md)
- [Setup Guide](docs/06-SETUP-GUIDE.md)

## Engineering audit and local checks

The repository contains the storefront, customer account, checkout, Razorpay and admin implementations. See [the engineering audit](docs/ENGINEERING-AUDIT-2026-11-13.md) for verified fixes, test results and remaining release blockers.

```bash
npm run typecheck
npm run lint
npm run test:local
npm run build:local
```

`test:local` runs eight suites with explicit test doubles and service credentials isolated. `build:local` intentionally points services at unavailable local endpoints; it verifies compilation and failure handling, not live integrations. Do not deploy that localhost-configured build. Existing integration/reset/seed scripts can mutate external systems: review their targets before running them.

### Weekly Security Audit Routine (Run Every Friday)

```bash
# 1. Automated security test suite (16 test assertions)
npm run test:security

# 2. Verify active security headers on live production
curl -sI https://star-press.vercel.app/login | grep -i -E "security|x-frame|x-content|permissions|referrer"
```

```sql
-- 3. Review AuthAuditLog for suspicious brute-force or credential stuffing patterns:
SELECT "ipAddress", COUNT(*) as failed_count
FROM "AuthAuditLog"
WHERE "action" = 'LOGIN_FAILURE'
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "ipAddress"
ORDER BY failed_count DESC
LIMIT 20;
```
