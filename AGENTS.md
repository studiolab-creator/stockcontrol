# StockControl — Project Guide

## Project

Sistema web de control de stock para un equipo interno. Permite registrar
inventario de productos terminados e insumos, con entrada manual y salida por
escaneo de QR desde celular.

**Core Value:** Saber exactamente cuánto stock hay de cada producto en todo
momento, sin desfasajes entre lo físico y el sistema.

## Single Source of Truth

All project planning lives in this repository under `.planning/`.

- Current state: `.planning/STATE.md`
- Roadmap: `.planning/ROADMAP.md`
- Requirements: `.planning/REQUIREMENTS.md`

Do not create or use StockControl planning files outside this repository. Do
not duplicate phase status in this guide; read the planning documents so status
cannot drift.

## GSD Workflow

```text
/gsd-discuss-phase N    — Gather context before planning a phase
/gsd-plan-phase N       — Create detailed execution plan
/gsd-execute-phase N    — Execute the plan
/gsd-verify-work N      — Verify phase goal was achieved
/gsd-progress           — Show overall progress
```

### Mode: Interactive

Confirm at each major step before proceeding.

## Architecture Constraints (NON-NEGOTIABLE)

| Constraint | Rule |
|------------|------|
| **Auth** | Username + password only. Email is for notifications ONLY — never for login. |
| **Stock mutations** | Atomic SQL mutation in the same transaction as the movement insert. NEVER read-then-write. |
| **QR content** | Encode only the immutable product UUID. Never a name, slug, or mutable field. |
| **HTTPS** | Required for production and mobile camera access. |
| **Alert dedup** | Use the per-product `alertActive` flag. Fire once on downward crossing; reset when stock recovers. |
| **Ledger** | The movements table is append-only. Never UPDATE or DELETE movement rows. |

## Current Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- PostgreSQL + Prisma 7
- Custom JWT authentication with `jose` and `bcryptjs`
- Zod 4
- Resend 6

<!-- BEGIN:nextjs-agent-rules -->
## Next.js Agent Rules

This version has breaking changes — APIs, conventions, and file structure may
all differ from prior versions. Read the relevant guide in
`node_modules/next/dist/docs/` before writing code and heed deprecation notices.
<!-- END:nextjs-agent-rules -->
