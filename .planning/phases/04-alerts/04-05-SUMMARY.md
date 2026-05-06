---
phase: 04-alerts
plan: "05"
subsystem: ui
tags: [badge, table, stock, tailwind, shadcn]

# Dependency graph
requires:
  - phase: 04-alerts/04-00
    provides: Prisma schema with stock and minStock fields on Product model
provides:
  - Stock column with low-stock badge in /productos catalog table
affects: [04-alerts, verifier]

# Tech tracking
tech-stack:
  added: []
  patterns: [stock <= minStock visual indicator using Badge variant=destructive, same threshold pattern as DashboardClient]

key-files:
  created: []
  modified:
    - src/app/(app)/productos/page.tsx

key-decisions:
  - "Badge condition uses stock <= minStock (not alertActive) per D-05 — visual indicator is independent of alert state"
  - "Stock display includes unit suffix when unidad is set: '{stock} {unidad}'"
  - "No query change needed — prisma.product.findMany already returns stock and minStock via full Product model"

patterns-established:
  - "Stock column pattern: flex items-center gap-2 with stock value + optional destructive Badge"

requirements-completed: [ALERT-05]

# Metrics
duration: 5min
completed: 2026-05-06
---

# Phase 4 Plan 05: Products Stock Column Summary

**Stock column added to /productos catalog table with `stock <= minStock` badge using the same DashboardClient destructive badge pattern**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-06T00:00:00Z
- **Completed:** 2026-05-06T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `<TableHead>Stock</TableHead>` between Unidad and Stock mínimo columns
- Added `<TableCell>` with stock value (with optional unit suffix) and conditional `<Badge variant="destructive">Stock bajo</Badge>`
- Badge shows whenever `product.stock <= product.minStock` (D-05 — intentionally `<=`, not `<`)
- No query changes needed — existing `findMany` with `include: { categoria: true }` already returns `stock` and `minStock`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Stock column with low-stock badge to /productos table** - `fd879b4` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/app/(app)/productos/page.tsx` - Added Stock column header and table cell with badge

## Decisions Made
- Badge condition is `product.stock <= product.minStock` per D-05. This is intentionally more inclusive than the email alert trigger (`stock < minStock`): the visual warns when stock is at or below minimum; the email fires only on crossing below minimum.
- Reused the identical `flex items-center gap-2` + `Badge variant="destructive"` pattern from DashboardClient for consistency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build failure in `/productos/[id]` and `/reducir/[productId]` due to missing `RESEND_API_KEY` environment variable during static page data collection. This is unrelated to the changes made in this plan and was present before this task. TypeScript check (`npx tsc --noEmit`) passes cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 plans of Phase 4 (Alerts) are complete
- Wave 3 is done: email alerts with dedup, manual alert testing, alerts management page, and visual stock indicators in both /dashboard and /productos
- Pre-existing build-time error from missing RESEND_API_KEY should be resolved before production deployment

---
*Phase: 04-alerts*
*Completed: 2026-05-06*
