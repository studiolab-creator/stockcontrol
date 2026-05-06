---
phase: 04-alerts
plan: "03"
subsystem: api
tags: [prisma, resend, email, alerts, stock]

# Dependency graph
requires:
  - phase: 04-01
    provides: sendLowStockAlertWithRetry email function in src/lib/email.ts
  - phase: 04-02
    provides: alertActive CAS + email pattern established in QR path (reducir/[productId]/actions.ts)
provides:
  - Manual stock entry path (addStockMovement) fires alertActive + email on downward threshold crossing
  - Manual stock entry path resets alertActive on stock recovery above minStock
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-transaction findUnique for alert logic: read committed stock outside $transaction before CAS"
    - "CAS fire branch: updateMany WHERE alertActive=false; email only when count===1"
    - "Plain update reset branch: no CAS needed for recovery (no race condition)"

key-files:
  created: []
  modified:
    - src/app/(app)/productos/[id]/actions.ts

key-decisions:
  - "D-02 strict threshold: stock < minStock fires alert (not <=)"
  - "D-03 strict reset: stock > minStock resets alertActive (not >=)"
  - "D-04: alert logic runs outside prisma.$transaction — stock committed first, then CAS + email"
  - "findUnique post-transaction instead of returning from transaction — reads confirmed committed values"

patterns-established:
  - "Manual path alert pattern: findUnique post-commit → CAS updateMany → email on count===1"
  - "Recovery reset pattern: plain update (no CAS) when delta > 0 && stock > minStock && alertActive"

requirements-completed: [ALERT-01, ALERT-02, ALERT-03]

# Metrics
duration: 8min
completed: 2026-05-06
---

# Phase 4 Plan 03: Manual Stock Alert Summary

**Two-branch alertActive logic in addStockMovement: CAS-gated email fire on downward threshold crossing, plain-update reset on stock recovery above minStock**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-06T00:00:00Z
- **Completed:** 2026-05-06T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `sendLowStockAlertWithRetry` import and post-transaction two-branch alert logic to `addStockMovement`
- Branch A (fire): post-transaction `findUnique` reads committed stock; `updateMany WHERE alertActive=false` CAS prevents duplicate alerts; email sent only when `count === 1`
- Branch B (reset): plain `update` resets `alertActive` when `delta > 0 && stock > minStock && alertActive === true`
- Removed placeholder comment "Product.alertActive is NOT touched here"
- Added `revalidatePath('/alertas')` to invalidate alerts page cache after every stock mutation

## Task Commits

1. **Task 1: Add two-branch alertActive logic to addStockMovement** - `8373d18` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `src/app/(app)/productos/[id]/actions.ts` - Added import, post-transaction alert fire + reset logic, revalidatePath('/alertas')

## Decisions Made

- Used `findUnique` post-transaction (reads committed DB values) rather than returning data from inside the transaction — avoids coupling alert logic to the transaction boundary and reads the true committed state
- Branch A uses `updateMany WHERE { id: productId, alertActive: false }` CAS (D-01) — prevents duplicate emails on concurrent manual entries
- Branch B uses plain `update` without CAS — stock recovery has no concurrent-race risk (reset is idempotent)
- `motivo: 'Entrada manual'` distinguishes manual-path emails from QR-path emails ('Escaneo QR') in email content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - `npx tsc --noEmit` passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both stock mutation paths (QR via `reducir/[productId]/actions.ts` and manual via `productos/[id]/actions.ts`) now implement full alertActive fire + reset logic
- Phase 4 alert trigger coverage is complete for ALERT-01, ALERT-02, ALERT-03
- Ready for 04-04 (alerts page UI) and any remaining phase plans

---
*Phase: 04-alerts*
*Completed: 2026-05-06*
