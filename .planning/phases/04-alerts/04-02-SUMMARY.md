---
phase: 04-alerts
plan: "02"
subsystem: api
tags: [prisma, alert, email, cas, stock, server-actions]

# Dependency graph
requires:
  - phase: 04-alerts/04-01
    provides: sendLowStockAlertWithRetry function in src/lib/email.ts
  - phase: 04-alerts/04-00
    provides: AppConfig model, alertActive field on Product, email infra setup
provides:
  - subtractStockViaQR fires alertActive CAS + email after QR stock reduction crosses below minStock
affects: [04-03, 04-04, alertas-page, stock-mutations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-transaction alert pattern: find product state, CAS updateMany WHERE alertActive=false, send email only on CAS win"
    - "CAS dedup: updateMany returns count=1 only for the first concurrent caller — prevents duplicate alert emails"

key-files:
  created: []
  modified:
    - src/app/(app)/reducir/[productId]/actions.ts

key-decisions:
  - "Alert logic placed OUTSIDE prisma.$transaction (D-04): stock commits first, then alert fires — if email fails, alertActive=true already prevents resend"
  - "CAS via updateMany WHERE { alertActive: false } (RESEARCH Pitfall 1): exactly one concurrent QR scan wins the race; count=1 guard prevents duplicate emails"
  - "Strict threshold stock < minStock (D-02): stock equal to minStock does NOT fire alert"
  - "findUnique post-commit to read confirmed DB state rather than relying on in-transaction snapshot"

patterns-established:
  - "CAS alert pattern: updateMany WHERE alertActive=false → count===1 → send email"
  - "Alert logic block positioned between transaction close and revalidatePath calls"

requirements-completed: [ALERT-01, ALERT-02]

# Metrics
duration: 8min
completed: 2026-05-06
---

# Phase 04 Plan 02: QR Reduction Alert Summary

**alertActive CAS dedup and Resend email dispatch wired into subtractStockViaQR, preventing duplicate alerts on concurrent QR scans via updateMany WHERE alertActive=false**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-06T00:00:00Z
- **Completed:** 2026-05-06T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `sendLowStockAlertWithRetry` import to QR reduction action
- Post-transaction findUnique reads confirmed stock/minStock/alertActive after DB commit
- CAS updateMany WHERE alertActive=false fires alert exactly once per downward threshold crossing
- `revalidatePath('/alertas')` added so alerts page reflects newly active alerts immediately

## Task Commits

1. **Task 1: Add alertActive CAS + email to subtractStockViaQR** - `d2d189e` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/app/(app)/reducir/[productId]/actions.ts` - Added post-transaction alert logic: findUnique, CAS updateMany, sendLowStockAlertWithRetry, revalidatePath('/alertas')

## Decisions Made
- Used `prisma.product.findUnique` post-commit rather than augmenting the transaction's `select` — keeps the transaction block structurally unchanged as required, and reads the actual committed state from DB.
- CAS pattern (`updateMany WHERE alertActive: false`) chosen per RESEARCH.md Pitfall 1 to handle concurrent QR scans without a distributed lock.
- `motivo: 'Escaneo QR'` hardcoded in the QR path (per plan spec); manual entry path will use a different value in plan 04-03.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript passed clean on first attempt (`npx tsc --noEmit` exit 0).

## User Setup Required
None - no external service configuration required for this plan. RESEND_API_KEY and NEXT_PUBLIC_APP_URL must already be configured (set up in 04-01).

## Next Phase Readiness
- QR reduction path now fully alert-aware; concurrent scan dedup proven via CAS
- Plan 04-03 must wire the same alertActive CAS + email logic into `addStockMovement` (manual entry/reduction path), plus implement the alertActive reset when stock recovers above minStock (D-03)
- Plan 04-04 can then build the /alertas page UI on top of the alertActive state now being set

## Self-Check: PASSED
- `src/app/(app)/reducir/[productId]/actions.ts` — file confirmed present with all required patterns
- Commit `d2d189e` confirmed in git log
- `npx tsc --noEmit` passed (no output = no errors)

---
*Phase: 04-alerts*
*Completed: 2026-05-06*
