---
phase: "04"
plan: "01"
subsystem: email
tags: [resend, email, alerts, server-only, retry]
dependency_graph:
  requires: ["04-00"]
  provides: ["sendLowStockAlertWithRetry via @/lib/email"]
  affects: ["04-02", "04-03"]
tech_stack:
  added: []
  patterns:
    - "Module-level Resend singleton (resend@6.12.3)"
    - "idempotencyKey passed as second arg to resend.emails.send (SDK v6 two-arg API)"
    - "3-attempt linear retry (1s) on 429/500 only"
    - "AppConfig PK lookup for global alert email"
key_files:
  created:
    - src/lib/email.ts
  modified: []
decisions:
  - "idempotencyKey is a separate second argument (CreateEmailRequestOptions), not spread into payload — discovered from Resend v6 type definitions"
  - "Email HTML uses HTML entities for emoji/accented chars to maximize email client compatibility"
  - "Function never throws — logs warn on missing config, logs error on send failure"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-06"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 4 Plan 01: Email Utility Summary

**One-liner:** Server-only Resend email utility with 3-attempt retry and idempotency key for low-stock alerts.

## What Was Built

Created `src/lib/email.ts` — a server-only module that:

1. Initializes a module-level Resend singleton using `RESEND_API_KEY` env var.
2. Exports `SendLowStockAlertParams` type with `productId`, `productName`, `currentStock`, `minStock`, `motivo`.
3. Implements internal `sendWithRetry()`: 3 attempts, 1-second linear backoff, retries only on `statusCode === 429 || statusCode === 500`. The idempotency key is passed as the second argument to `resend.emails.send()` (Resend SDK v6 separates email payload from request options).
4. Implements internal `buildAlertEmailHtml()`: simple HTML table with product name, current stock (red), min stock, movement type, and a direct link to `/productos/{id}`.
5. Exports `sendLowStockAlertWithRetry(params)`: fetches `alert_email` from `prisma.appConfig`, logs `console.warn` and returns if not configured, then calls `sendWithRetry` with idempotency key `stock-alert/{productId}`.

The function is called OUTSIDE `prisma.$transaction` per D-04 — the caller commits stock + sets `alertActive=true` first, then this function runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resend SDK v6 idempotencyKey API differs from plan's code sample**
- **Found during:** Task 1 — TypeScript check
- **Issue:** The plan's code spread `idempotencyKey` into the payload object. In Resend SDK v6, `idempotencyKey` is part of `CreateEmailRequestOptions` (second argument), not `CreateEmailOptions` (first argument). Spreading it caused TS error TS2345.
- **Fix:** Changed `resend.emails.send({ ...payload, idempotencyKey })` to `resend.emails.send(payload, { idempotencyKey })`.
- **Files modified:** `src/lib/email.ts`
- **Commit:** 15a95f8 (same commit)

## Known Stubs

None — the function is fully wired. AppConfig lookup is live Prisma query; Resend send is live SDK call. No hardcoded or placeholder values in the public API surface.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model already covers (T-04-01, T-04-03, T-04-04).

## Self-Check: PASSED

- `src/lib/email.ts` exists: FOUND
- Commit 15a95f8 exists: FOUND
- `npx tsc --noEmit` exits 0: PASSED
- `import 'server-only'` present: FOUND
- `export async function sendLowStockAlertWithRetry` present: FOUND
- `prisma.appConfig.findUnique` present: FOUND
- `stock-alert/${params.productId}` idempotency key present: FOUND
- `maxAttempts = 3` present: FOUND
- `error.statusCode === 429 || error.statusCode === 500` present: FOUND
- `console.warn('[alert] No global alert email configured` present: FOUND
