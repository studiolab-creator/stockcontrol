---
phase: 03-qr-workflow
plan: "04"
subsystem: stock-reduction
tags: [server-action, prisma-transaction, atomic-mutation, qr-workflow, client-component]
dependency_graph:
  requires:
    - 03-00 (Wave 0 base — Prisma schema, shared lib, auth)
  provides:
    - /reducir/[productId] — atomic stock reduction endpoint for QR workflow
    - subtractStockViaQR — Server Action implementing STOCK-02 atomic constraint
  affects:
    - /dashboard (revalidated after each reduction)
    - /historial (revalidated; new 'Escaneo QR' movements appear)
    - /productos/[id] (revalidated after each reduction)
tech_stack:
  added: []
  patterns:
    - prisma.$transaction with { increment: negative_delta } — atomic stock reduction
    - useActionState + submittedRef — prevents premature toast on mount
    - notFound() boundary — triggers not-found.tsx for invalid QR UUIDs
    - subtractStockViaQR.bind(null, product.id) — productId pre-bound at render time
key_files:
  created:
    - src/app/(app)/reducir/[productId]/actions.ts
    - src/app/(app)/reducir/[productId]/page.tsx
    - src/app/(app)/reducir/[productId]/reducir-client.tsx
    - src/app/(app)/reducir/[productId]/not-found.tsx
  modified: []
decisions:
  - "delta = -cantidad forced in Server Action, not in Client — form input is always positive, forced negative server-side"
  - "Returns { success: true } (not undefined) to enable page-level success state detection without relying on state === undefined"
  - "2-step flow implemented via useState in single page (no /confirmar route) per D-06"
  - "getAuthenticatedUser() used (not requireAdmin()) — both ADMIN and OPERADOR can reduce via QR"
  - "alertActive NOT touched — Phase 4 only"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  files_created: 4
---

# Phase 3 Plan 4: /reducir/[productId] — Stock Reduction Flow Summary

**One-liner:** Atomic QR stock reduction via prisma.$transaction + forced-negative delta, 2-step Client Component UI with useActionState, and notFound() boundary for invalid QR UUIDs.

## What Was Built

Four files implementing the stock reduction endpoint of the QR workflow:

1. **`actions.ts`** — `subtractStockViaQR` Server Action. Uses `prisma.$transaction` with `{ increment: delta }` where `delta = -cantidad` (forced negative). Post-update floor check `if (updated.stock < 0) throw INSUFFICIENT_STOCK` triggers ROLLBACK. `motivo` hardcoded to `'Escaneo QR'`. Returns `{ success: true }` on success. Satisfies STOCK-02 and T-03-04-04.

2. **`page.tsx`** — Server Component. Awaits `params` (Next.js 16 breaking change). Calls `getAuthenticatedUser()` and fetches product with `prisma.product.findUnique`. Calls `notFound()` for unknown UUIDs. Passes `subtractStockViaQR.bind(null, product.id)` to `ReducirClient`.

3. **`reducir-client.tsx`** — `'use client'` boundary. Manages 2-step flow (Step 1: quantity input, Step 2: confirmation preview). Uses `useActionState` + `submittedRef` to prevent premature toasts on mount. Shows inline error on Step 2 when `INSUFFICIENT_STOCK`. Shows success state with link to `/escanear` after confirmed reduction.

4. **`not-found.tsx`** — 404 boundary triggered by `notFound()` in page.tsx. Displays clear message for invalid QR UUID scans. Uses `render={<Link href="/escanear" />}` pattern from codebase.

## Deviations from Plan

None — plan executed exactly as written.

## Architecture Constraints Verified

| Constraint | Status |
|-----------|--------|
| Atomic SQL: `{ increment: delta }` in `$transaction` — never read-then-write | SATISFIED |
| delta forced negative for QR scan reductions | SATISFIED |
| movements table append-only — no UPDATE/DELETE on movement rows | SATISFIED |
| Product.alertActive not touched (Phase 4 only) | SATISFIED |
| QR content encodes only immutable UUID | N/A (this plan is the consumer, not the encoder) |
| getAuthenticatedUser() as first line in Server Action | SATISFIED |
| Both roles (ADMIN + OPERADOR) can reduce via QR | SATISFIED |

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-03-04-01 | `getAuthenticatedUser()` at top of ReducirPage — redirects unauthenticated to /login |
| T-03-04-02 | `prisma.product.findUnique` — unknown UUID returns null → `notFound()` (404) |
| T-03-04-03 | `z.coerce.number().int().positive()` rejects non-integer, non-positive, NaN values |
| T-03-04-04 | `prisma.$transaction` + `{ increment: delta }` + floor check ROLLBACK |
| T-03-04-05 | Next.js built-in CSRF protection on Server Actions (accepted) |
| T-03-04-06 | `motivo` hardcoded to `'Escaneo QR'` — not from formData |
| T-03-04-07 | `tx.movement.create` with userId records every reduction in append-only ledger |

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: subtractStockViaQR Server Action | `c9c1c39` | actions.ts |
| Task 2: page, client UI, not-found boundary | `4284e24` | page.tsx, reducir-client.tsx, not-found.tsx |

## Known Stubs

None — no placeholder text, hardcoded empty values, or unconnected data sources.

## Threat Flags

None — no new security surface beyond what is documented in the plan's threat model.

## Self-Check: PASSED

- FOUND: src/app/(app)/reducir/[productId]/actions.ts
- FOUND: src/app/(app)/reducir/[productId]/page.tsx
- FOUND: src/app/(app)/reducir/[productId]/reducir-client.tsx
- FOUND: src/app/(app)/reducir/[productId]/not-found.tsx
- FOUND commit: c9c1c39 (Task 1)
- FOUND commit: 4284e24 (Task 2)
- TypeScript: `npx tsc --noEmit` exits 0 (no new errors)
