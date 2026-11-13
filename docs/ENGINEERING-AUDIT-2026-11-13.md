# StarPress engineering audit — 13 November 2026

## Scope and baseline

Repository inventory: 200 TypeScript/TSX source files, 52 API route files, 42 pages. Next.js App Router 14.2.35 / React 18.3.1; Tailwind; Prisma 5.22 PostgreSQL; Supabase authentication/storage plus NextAuth 4.24.15; Razorpay; Resend; optional Upstash rate limiting; Vercel cron. The static catalog, database products, and JSON overrides are competing catalog sources. Orders also have an on-disk JSON mirror. Services generally live in `src/server`, route handlers under `src/app/api`.

Initial working tree was clean. Baseline `tsc --noEmit` passed; lint passed with six warnings (four images, two hook dependencies). No automated browser test runner is configured. Some scripts use live databases or create gateway orders and must not be run against existing credentials without approval. Local environment files are not tracked; `src/data/store.json` IS tracked and contains 28 order records. Contents were not printed. Do not delete or rewrite this data without an approved backup/migration.

This is a repository review, not a certification of the deployed site. Source inventory and cross-cutting scans cover the repository; detailed inspection concentrates on authorization, checkout, payments, persistence, customer APIs, catalog, SEO and UI entry points. Every screen and live integration still needs staging execution. Current production credentials, RLS policies, DNS, webhook configuration and customer data were not accessed.

## Prioritized findings (before implementation)

| ID | Severity | Evidence / consequence | Planned response |
|---|---|---|---|
| SEC-01 | Critical | `api/reviews` creates a published product with arbitrary slug and price when a signed-in customer reviews an unknown product. Customer route bypasses admin catalog control. | Reject unknown products; validate review input and rate limit. |
| PAY-01 | Critical | Both payment verification routes accept `authorized` as paid. Main verifier does not unconditionally bind submitted gateway order to stored order; recorder trusts amount and treats any existing payment ID as success. | Require capture and exact gateway binding; validate amount inside transaction; reject cross-order replay. |
| AUTH-01 | High | Email allowlist grants admin without verified email, including legacy registration with no implemented verification flow. `syncAllSupabaseUsersToDb` hardcodes admin emails and overwrites existing roles. | Verified email required for email-based elevation; preserve explicit DB roles during directory sync. |
| DATA-01 | High | Address/profile/inquiry handlers return invented success after DB failure. Admin order creation/status mutations can succeed in local JSON only. | Fail closed, retain original data, show retry errors. |
| PRIV-01 | High | Tracking uses `guestPhone contains input`; single digit or whitespace can match orders. Tracked JSON order mirror includes customer records and is not durable on Vercel. | Exact normalized contact match; document controlled data removal/migration. |
| PRICE-01 | High | Quote silently floors fractional quantities, accepts arbitrary variant IDs with default pricing, falls back after DB failure, and honors deleted built-in coupons. | Validate inputs/options and fail closed on authoritative lookup failures; database-only coupons. |
| ORDER-01 | High | Idempotency uses substring notes lookup outside transaction; concurrent requests can create multiple orders. Coupon limits checked separately from usage increment. Manual orders do not reserve tracked inventory. | Requires transaction/concurrency work and PostgreSQL integration coverage; release blocker until verified. |
| AUTH-02 | High | Middleware recognizes only Supabase although route resolver also supports NextAuth; resolved Supabase ID may differ from existing Prisma account ID. | Align middleware session recognition and canonical application identity. |
| UX-01 | Medium | Failed quote keeps stale totals; cart blindly trusts parsed localStorage; newsletter promises a coupon without any request or persistence. | Quote loading/error guard, validate stored cart, persist subscription requests through existing inquiry service with truthful feedback. |
| PERF-01 | Medium | Admin order listing loads all rows and rewrites entire JSON per row; API middleware duplicates auth calls. Wildcard remote image origins; hero raw image. | Avoid redundant middleware API auth, optimize hero; retain pagination/cache work in backlog. |
| SEO-01 | Medium | Static-only sitemap omits live products; root canonical inherited by unrelated pages; generic social profile links and manufactured rating defaults. | Live sitemap, remove misleading defaults; page-specific metadata follow-up. |
| OPS-01 | Medium | No migration directory; excluded test scripts; several test commands require undeclared `tsconfig-paths`; mutable live integration scripts. | Offline regression harness, documented safe commands and staged migration process. |
| QUALITY-01 | Low | Stale scaffold README, 406 `any` occurrences, extensive swallowed catches, lint warnings. | Fix affected types/hooks and document remaining debt; avoid wholesale rewrite. |

Payment capture semantics checked against Razorpay's official documentation: https://github.com/razorpay/markdown-docs/blob/master/payments/payments/capture-settings/api.md and https://github.com/razorpay/markdown-docs/blob/master/webhooks/payments.md.

## Additional release checks

- Run sandbox checkout through login, variants, quantity changes, saved addresses, proof/online payments, retry, duplicate delivery, expiry, cancellation and refunds.
- Exercise every admin mutation with customer, revoked admin and valid admin sessions.
- Audit Supabase RLS/storage policies and configured credential scopes; assess git history for customer data before any history cleanup.
- Verify webhook failure/retry semantics, out-of-order refunds, duplicate captures, stock restoration, coupon concurrency and tax/invoice business rules.
- Verify mobile/tablet/desktop layouts, keyboard focus, dialog focus trapping, screen reader feedback, actual CWV and bundle/image budgets.
- Dependency vulnerability audit needs current registry data; installed versions alone are not a security verdict.

Implementation and verification results will be appended below. Findings remain open unless explicitly marked fixed and tested.

## Changes implemented

### Security and payments

- **SEC-01:** review submission rejects unknown products instead of creating published catalog records. Added per-user throttling, integer rating validation, and bounded product identifiers. Reviews no longer claim verified purchase without evidence.
- **PAY-01:** both browser verification routes require `captured`, INR, and matching gateway order identifiers. The main route requires an authenticated owner/admin and binds the request to the stored gateway order before REST verification. The legacy route propagates recording failure and sends repeat captures through the recorder. The recorder rejects cross-order payment replay and checks amounts/binding inside its transaction. A previously FAILED ledger entry can be upgraded on a subsequent capture. Webhook capture handlers now return failure when persistence fails so the gateway can retry; successful capture REST responses are validated.
- **AUTH-01 (partial):** email allowlist elevation requires verified email. Directory sync no longer hardcodes privileged email addresses or overwrites existing database roles. Cross-provider user linking by email requires verified email. The resolver carries verified metadata and uses the canonical Prisma ID when available. Other legacy authentication/ownership paths still require consolidation (see release blockers).
- **PRIV-01 (tracking fixed):** removed substring phone matching and local-store fallback from public tracking. Requires an exact email or a complete normalized Indian phone number. Malformed, blank and partial contact values do not match.
- Added bounded Zod checkout and quote schemas. Quotes reject fractional/unsafe quantities, oversized carts and unknown variant identifiers. Database lookup failures return 503 instead of silently pricing stale catalog data. Coupons must exist in the database; deleted built-in codes cannot reappear during an outage. Percentage discounts are capped at subtotal.

### Persistence and reliability

- **DATA-01 (partial):** address/profile and all three inquiry write paths now return errors on failed persistence, rather than invented records/success. Manual order creation and order status changes cannot report local-only success after failed DB writes. Existing local records are preserved.
- Address create/update/delete operations run in a transaction with a per-user database row lock, including default-address changes.
- Profile updates use the central user resolver and the existing strong password policy. Removed duplicated provider-resolution logic from this route.
- Middleware skips redundant session calls for APIs, recognizes NextAuth tokens as well as Supabase for protected routes, and allows the public order-tracking page. Client hook/checkout support was added in the follow-up below; end-to-end provider verification remains outstanding.

### UI, performance and SEO

- Checkout clears stale quotes, aborts obsolete requests, displays quote loading/errors and disables order submission without a valid current quote.
- Stored cart data must be an array of valid line items; invalid quantity updates are ignored.
- Newsletter now saves an actual subscription **request** through the existing contact-inquiry endpoint and reports submission failure. It no longer promises an emailed coupon. This is not an automated mailing-list integration; requests need a staff workflow.
- Testimonials show database-backed feedback, or an honest empty/unavailable state. Hardcoded five-star “verified” fallback testimonials and fabricated review text were removed. No review feature or customer record was deleted.
- Fixed two stale hook dependencies without adding a product-refetch loop. Hero failure fallback now uses a local optimized Next Image.
- Sitemap uses the live catalog service. Removed generic social-site `sameAs` declarations, unverified aggregate-rating structured data, placeholder verification token and root canonical inheritance that incorrectly pointed unrelated pages to the homepage.
- Removed Prisma generation as an implicit side effect of loading `next.config.js`; existing build/postinstall scripts retain generation.
- Added `test:local`, `test:audit`, `typecheck`, and `build:local`. The local runner replaces configured service environment values before Next/Prisma can load them. Regression harness blocks actual database/network/email/storage writes and executes production functions/handlers against explicit doubles. Those doubles are test-only; production does not serve them.

## Verification results

User explicitly restricted this work to **local checks only**. No live login, order creation, payment, refund, email, migration, credential rotation, production data mutation, or deployment was performed.

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass with 3 remaining image warnings in `src/app/admin/orders/page.tsx`; baseline was 6 warnings |
| `npm run build:local` | Pass, production compilation and route generation; DB unavailable intentionally, so catalog fallback warnings are expected |
| `npm run test:local` | All eight suites pass, process exits 0 |
| New audit regressions | 53 checks pass: authorization, quote validation, coupon removal, persistence failures, tracking, payment capture/binding/replay, address transaction rollback, profile failure |
| Existing security suite | 16 assertions pass |
| Existing quote suite | 26 assertions pass with explicit test DB coupon records |
| Existing checkout-auth suite | 22 assertions pass |
| Existing ordering suite | 24 assertions pass |
| Existing payment readiness suite | 20 assertions pass |
| Existing inventory suite | All 6 scenarios pass, including late capture/restock and refund flagging |
| Existing refund suite | Pass: paise precision, replay, concurrent mocked transactions and over-refund flagging |
| `git diff --check` | Pass |
| Browser, local production preview | Homepage → business-card product → square variant (₹344 for 100) → add to cart → cart retains selected size/material/quantity → checkout shows DB-unavailable quote message and disables payment; unauthenticated sign-in prompt preserves cart |
| Responsive spot check | Cart/checkout inspected with a 390×844 browser viewport override; reset afterward. Not a full breakpoint/accessibility audit |

Test fixture corrections: inventory capture fixtures previously supplied ₹100 regardless of actual order total; now use the created order total. Checkout stock fixtures used obsolete variant IDs; now select real catalog options. Ordering/quote suites receive explicit DB doubles instead of depending on database outages. These changes preserve the original scenarios while exercising the stricter checks.

Build summary: shared first-load JavaScript approximately 87.6 kB; shop page approximately 219 kB including shared dependencies. These are build estimates, **not** measured Core Web Vitals. The local Node 20 runtime emitted a Supabase deprecation warning; plan and test a supported runtime upgrade. The local build uses localhost canonical URLs and MUST NOT be deployed as a production artifact; rebuild with approved production configuration.

## Remaining issues and release gates

The codebase is improved, but **not certified production-ready**. In particular:

1. **High — verify database concurrency:** transaction advisory locks now serialize checkout retry keys, coupon admission counts pending reservations under a coupon row lock, proof coupon usage commits with order creation, and manual orders/reopened cancellations reserve inventory. Local concurrency doubles pass, but actual PostgreSQL locking/deadlock behavior remains unverified. Retry keys still live in notes (24-hour scope), without a dedicated indexed unique column. Late captures after coupon reservation expiry and admin reopening of expired discounted orders require explicit business-policy tests and a migration plan for durable idempotency metadata.
2. **High — competing persistence sources:** order reads/admin lists/product overrides/settings still use local JSON fallbacks. Settings writes and bulk product status writes now propagate failures. Other admin product/image mutations still have swallowed database errors. Do not treat ephemeral serverless files as durable storage. Inventory and preserve local-only records, migrate/verify them, then retire fallback writes. The tracked file contains 28 orders and was left unchanged; repository history exposure needs a controlled privacy review. Do not simply delete it or reset production.
3. **High — identity consolidation:** The shared client hook and checkout now support NextAuth cookie sessions alongside Supabase. Customer order-list/detail/cancellation routes use canonical identity and verified-email ownership. These changes compile and server access checks have regression coverage, but full provider login/logout, OAuth account linking, recovery, admin revocation and database-only admin roles still need staging browser tests. Profile password changes still target Prisma credentials rather than Supabase passwords. Legacy registration generates verification tokens without a complete delivery/verification route. Directory sync pagination is capped at 1,000 users.
4. **High — gateway lifecycle:** mocked tests cannot prove PostgreSQL row locking, gateway webhook retries, timeout-after-refund reservations, out-of-order refund statuses or duplicate capture races. Automatic refunds/cron need an approved Razorpay test account and isolated database before any live work. Do not enable live financial workflows based solely on these results.
5. **Medium — broader validation/error handling:** customer and admin routes beyond the changed paths still use casts/`any`, insufficient string/body bounds and swallowed errors. Address/profile payload type validation and inquiry spam/content limits should be hardened further. Rate limiting needs a configured distributed backend for multi-instance deployments.
6. **Medium — catalog truth:** static catalog inventory/rating defaults and multiple overlay sources can still advertise stale availability or unsupported review counts. Static definitions remain intentional catalog content, but must be reconciled with authoritative inventory. Deleted/disabled catalog items and DB-defined variant configuration need regression coverage.
7. **Medium — performance:** admin order listing fetches all rows and rewrites JSON per order. Move filtering/pagination/counts into the database after local data reconciliation. Broad image remotePatterns and CSP `unsafe-eval`/`unsafe-inline` need integration-aware tightening. Do not break customer artwork or gateway flows by blindly removing origins.
8. **Medium — SEO/accessibility:** finish individual page canonicals/noindex metadata, confirm actual social URLs, verify structured-data price/availability against configured variants, keyboard/focus behavior, form label associations, reduced motion, contrast and tablet/desktop layouts. Footer generic social links and static copyright year remain. Cart quantity-button interaction was not conclusively verified in the browser spot check.
9. **Medium — operations/dependencies:** no versioned migration history is present. No current dependency advisory audit or live RLS/storage/credential/DNS audit was performed under the local-only scope. Existing direct test scripts still include live integrations; use `npm run test:local`, not blanket execution of every script. Some old standalone commands depend on undeclared `tsconfig-paths`; the new local harness supplies alias resolution without adding a production dependency.
10. **Low — maintenance:** broad `any` usage, duplicated services and stale docs remain. Three raw admin artwork image warnings remain; rendering original proof files may intentionally differ from optimized storefront images.

Recommended next step: review this patch, provision isolated PostgreSQL/Supabase/Razorpay test services, complete the high-priority persistence and concurrency work, then execute the full customer/admin journey matrix. No deployment is recommended until those gates pass.


## Follow-up implementation after “continue”

- **New Critical finding, fixed locally:** customer cancellation previously guarded ownership only when an order had `userId`; guest orders bypassed that guard. Added shared `isOrderOwner`, requiring account-ID ownership or verified-email ownership. Applied it to order detail, history, cancellation, payment creation, verification and retry. Unauthenticated guest recovery no longer initiates payment. Cancellation eligibility is rechecked under the order lock.
- Checkout retry handling now includes paid orders, rejects reuse of a key with different request data, and rechecks under a PostgreSQL advisory transaction lock before insert. Machine retry/coupon metadata survives edited notes. Database lookup failures propagate instead of creating a potential duplicate. Paid retries bypass checkout charging; cancelled retries report a clear error.
- Coupon admission now locks the coupon row, revalidates the current discount and accounts for outstanding online reservations. Proof-order usage increments inside the order transaction. Online capture updates usage under the same row lock. Zero-balance orders are confirmed as paid server-side without a gateway charge and consume their coupon use immediately.
- Manual orders reserve tracked inventory in the same transaction as order creation and reject invalid quantities/prices. Cancelled manual orders do not reserve stock. Reopening a cancelled order reallocates stock atomically, clears the restock marker and renews an expired payment window. Manual mark-paid uses a transaction and preserves existing fulfillment/cancellation status.
- Admin order metadata/status failures, store-setting writes and bulk product status failures no longer report invented success. General admin PATCH can still perform status and metadata in separate transactions; all-or-nothing multi-field updates remain follow-up work.
- `useAuthSession` now combines Supabase and NextAuth sessions, and logout clears both. Checkout accepts cookie-based authentication without requiring a Supabase bearer token. The server remains the authorization boundary.
- Audit suite expanded from 36 to **53** passing checks, including simultaneous retry submissions, paid retry, changed-cart conflict, coupon reservation exhaustion, coupon change, final-use contention, stock reallocation, manual stock rejection, verified-email ownership and guest cancellation/retry authorization, zero-balance settlement and FAILED-to-captured ledger upgrade.
- These additions require no schema change and no live data migration was applied. Local tests use transaction doubles; actual database isolation and full provider/browser flows remain release gates.

## Phase-wise implementation — second follow-up

The user subsequently authorized working directly with hosted Supabase and Vercel; Docker is not a prerequisite. No hosted mutation or deployment has been made during this follow-up. The earlier local-only verification results remain historical evidence, not a restriction on subsequently authorized work.

### Phase 1: durable writes and access control — implemented locally

- Product updates and image-record replacement now share a database transaction with their audit log. Image failures roll back product edits. Database failure propagates instead of writing a local-only override.
- Product deletion now archives durably using the same transaction. Historical order references and storage objects are retained. Detached storage objects need a separate, reference-aware garbage-collection workflow.
- Admin authorization reads the current database role on each request and fails closed on database outage. An existing CUSTOMER role overrides stale session/app metadata and email allowlists. Operators using an allowlisted email must explicitly provision their database ADMIN role; the allowlist only bootstraps missing accounts.
- Supabase directory synchronization requests successive pages instead of stopping at 1,000 users. Live execution remains untested.
- Addresses, profile changes, public inquiries and product create/update payloads use bounded schemas. Malformed JSON/types return 400. Public customization requests cannot supply another account's userId. Provider-only accounts receive a recovery instruction instead of comparing an absent Prisma password hash.

### Phase 2: refund integrity — implemented locally, broader lifecycle work remains

- Existing refund IDs are bound to their order, payment and amount. A delayed initiated/failed event cannot regress a processed refund; failed refunds cannot regress to pending. Invalid amount/status is rejected.
- Added local tests for reordered events and mismatched refund bindings. Gateway timeout reconciliation and actual PostgreSQL concurrency remain release gates.

### Phase 3: accessibility, SEO and performance — incremental changes implemented

- Confirmation dialogs have accessible labels/descriptions, initial focus, keyboard trapping, Escape cancellation, focus restoration and scroll locking. Loading blocks dismissal. Browser assistive-technology verification remains outstanding.
- Global reduced-motion CSS, current copyright year and configurable social-profile URLs replace generic platform home links.
- Robots rules cover exact private route prefixes. This is crawl guidance, not access control or a substitute for route-level noindex metadata.
- Removed per-row JSON rewrites from admin order listing. Legacy order reads and in-memory pagination remain until reconciliation; existing customer records were not modified.

### Verification

- Typecheck and local production build pass; lint passes with the same three admin artwork-image warnings. `git diff --check` passes.
- All eight offline suites pass; audit regression count increased from 53 to 62.
- New tests cover malformed account/product input, inquiry identity injection, revoked admin access, database outage, product archive/update failure and transactional image rollback. Refund suite additionally covers reordered and mismatched events.
- No hosted database or production browser verification is implied. The unavailable local Docker daemon does not block using the approved hosted environment.

### Production roadmap and acceptance gates

1. **Hosted baseline and recovery:** identify the deployed Git revision and Vercel project, compare the Supabase schema with Prisma, confirm database/storage backup and restore procedures, inspect RLS and storage policies, establish versioned migrations. Do not apply a reset or use schema push to reconcile unknown production drift.
2. **Single source of truth:** reconcile the 28 preserved JSON orders and all catalog overrides into Supabase using a dry-run report, stable identifiers and verified counts. Then retire runtime JSON mirroring/fallback and move pagination/filtering/counts into PostgreSQL.
3. **Commerce integrity:** add indexed unique checkout idempotency records, a durable webhook inbox, transactional notification outbox, explicit order/payment/refund transitions and a scheduled gateway reconciliation job. Resolve refund timeout reservations before permitting automatic retries. Test final coupon use, concurrent stock claims and late captures against hosted PostgreSQL with controlled test records.
4. **Identity and data privacy:** consolidate authentication/provider recovery, verify admin revocation in the UI, add admin MFA, private artwork storage with expiring access, file validation and retention/deletion controls. Never expose service-role keys to the browser.
5. **Print operations:** versioned artwork proofs and approval timestamps; production job tickets; controlled fulfillment transitions; shipping tracking; invoice downloads; reasoned refund/cancellation handling; reorder from an immutable specification snapshot.
6. **Operations and releases:** structured logs without customer payloads, error monitoring, payment/webhook/cron alerts, database pool/query monitoring, dependency checks and CI gates. Validate a Vercel deployment before promotion; retain a rollback target. Database changes need their own compatible rollout/recovery plan.
7. **Customer experience and growth:** mobile/keyboard journey tests, server-confirmed price and delivery estimates, clear proof/payment statuses, accessible artwork upload feedback, genuine purchase-backed reviews, per-page metadata and measured performance budgets. Marketing communications require consent and unsubscribe support before automation.
