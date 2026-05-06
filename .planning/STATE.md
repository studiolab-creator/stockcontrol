# Project State

## Project Reference

**Core value:** Saber exactamente cuánto stock hay de cada producto en todo momento, sin desfasajes entre lo físico y el sistema.
**Current focus:** Phase 4 — Alerts

## Current Position

Phase: 4 of 4 (Alerts)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-05-06 — ROADMAP.md, REQUIREMENTS.md, STATE.md created; Phases 1-3 reconstructed from codebase

Progress: ███████░░░ 75%

## Phase History

| Phase | Name | Status | Verified |
|-------|------|--------|---------|
| 1 | Foundation | Done ✓ | Yes |
| 2 | Core Ledger | Done ✓ | Yes |
| 3 | QR Workflow | Done ✓ | 2026-05-04 (22/22 truths, 4 human UAT complete) |
| 4 | Alerts | Ready to plan | — |

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-06
Stopped at: Planning documents created. Ready to plan Phase 4: Alerts.
