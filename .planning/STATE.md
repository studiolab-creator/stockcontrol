---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed Phase 4 Plan 00: Install Resend + AppConfig Schema"
last_updated: "2026-05-06T21:30:00.000Z"
last_activity: 2026-05-06 — Completed 04-00 (resend installed, AppConfig model in DB)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 11
  completed_plans: 6
  percent: 75
---

# Project State

## Project Reference

**Core value:** Saber exactamente cuánto stock hay de cada producto en todo momento, sin desfasajes entre lo físico y el sistema.
**Current focus:** Phase 4 — Alerts

## Current Position

Phase: 4 of 4 (Alerts)
Plan: 1 of 6 in current phase
Status: Executing — Wave 1 (04-01 next)
Last activity: 2026-05-06 — Completed 04-00: resend installed, AppConfig in DB

Progress: ███████░░░ 75%

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-06T21:30:00.000Z
Stopped at: Completed 04-00-PLAN.md — resend installed, AppConfig model pushed to Neon, Prisma client regenerated.
