---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed Phase 4 Plan 04: Alertas Page (email config form + alertActive products table)"
last_updated: "2026-05-06T21:58:46Z"
last_activity: 2026-05-06 — Completed 04-04: /alertas page with saveGlobalAlertEmail action + email form + alertActive table
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 11
  completed_plans: 10
  percent: 91
---

# Project State

## Project Reference

**Core value:** Saber exactamente cuánto stock hay de cada producto en todo momento, sin desfasajes entre lo físico y el sistema.
**Current focus:** Phase 4 — Alerts

## Current Position

Phase: 4 of 4 (Alerts)
Plan: 5 of 6 in current phase
Status: Executing — Wave 3 (04-05 next)
Last activity: 2026-05-06 — Completed 04-04: /alertas page with saveGlobalAlertEmail action + email form + alertActive table

Progress: █████████░ 91%

## Phase History

| Phase | Name | Status | Verified |
|-------|------|--------|---------|
| 1 | Foundation | Done ✓ | Yes |
| 2 | Core Ledger | Done ✓ | Yes |
| 3 | QR Workflow | Done ✓ | 2026-05-04 (22/22 truths, 4 human UAT complete) |
| 4 | Alerts | Ready to execute | — |

## Accumulated Context

### Key Decisions

- **Auth**: Username + password only. Email is for AlertConfig (Resend) recipients ONLY — never for login.
- **Stock mutations**: `prisma.$transaction` with `{ increment: negative_delta }` — atomic, never read-then-write.
- **QR content**: Encoded value is `product.id` (UUID) only — confirmed in Phase 3.
- **QR Scanner**: Uses `qr-scanner` library (replaced `html5-qrcode` after iOS issues). Uses `getUserMedia` directly + `scanImage` loop after iOS Safari compatibility fixes.
- **Schema**: All 4 phases fully defined in `prisma/schema.prisma`. `alertActive` and `AlertConfig` exist and are ready for Phase 4.
- **AlertConfig**: Per-product `emails: String[]` field. One `AlertConfig` per product (unique FK).
- **Prisma client**: Generated to `src/generated/prisma/` (not `node_modules/@prisma/client`).
- **Next.js**: App Router with Server Actions. Auth via custom JWT (jose + bcryptjs). No separate API layer for app logic except QR generation.
- **Tailwind v4**: Custom design system with `print:hidden` / `print:block` variants working.
- **AppConfig**: Global key-value store (`key String @id`) in DB. `alert_email` key stores single global alert recipient (D-07). Separate from per-product `AlertConfig`.
- **Resend SDK**: resend@6.12.3 installed. Requires `RESEND_API_KEY` env var. Use `from: onboarding@resend.dev` for dev (no domain verification needed).
- **Resend v6 idempotency**: `idempotencyKey` is the second argument to `resend.emails.send(payload, { idempotencyKey })` — not spread into the payload object.
- **Alert CAS pattern**: `prisma.product.updateMany({ where: { id, alertActive: false }, data: { alertActive: true } })` — only the first concurrent caller gets `count=1`; guards `sendLowStockAlertWithRetry` call. Prevents duplicate emails on concurrent QR scans.
- **Alert threshold**: `stock < minStock` (strict less-than, D-02). Stock equal to minStock does NOT fire alert.
- **Alert placement (D-04)**: Alert logic lives OUTSIDE `prisma.$transaction` — after transaction closes, before `revalidatePath` calls. Stock commit happens first; email is best-effort.
- **Alert reset (D-03)**: `alertActive` resets to `false` when `delta > 0 && stock > minStock && alertActive === true`. Plain `update` (no CAS) — recovery has no concurrent-race risk. Reset threshold is strict: `stock > minStock` (NOT >=).
- **Manual path motivo**: Email params use `motivo: 'Entrada manual'` for addStockMovement path (vs 'Escaneo QR' for QR path).

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-06T21:58:46Z
Stopped at: Completed 04-04-PLAN.md — /alertas page replaced placeholder with email config form + alertActive products table, tsc passes.
