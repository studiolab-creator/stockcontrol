---
phase: 03-qr-workflow
plan: "03-03"
subsystem: qr-management-ui
tags: [qr, admin, print, download, client-component, server-component]
dependency_graph:
  requires:
    - 03-01  # Route Handler /api/qr/[productId] — provides PNG endpoint used by download links and img src
  provides:
    - /qr functional page with product list, checkbox selection, PNG download, print sheet
  affects:
    - src/app/(app)/qr/page.tsx
    - src/components/qr-management-client.tsx
tech_stack:
  added: []
  patterns:
    - Server Component fetches → passes to Client Component (same as dashboard/historial)
    - useState<Set<string>> for multi-checkbox selection state
    - print:hidden / hidden print:block Tailwind v4 print CSS strategy
    - Native <input type="checkbox"> (avoids base-nova Checkbox indeterminate limitation)
    - Plain <a href> download anchor for PNG download (no JS required)
key_files:
  created:
    - src/components/qr-management-client.tsx
  modified:
    - src/app/(app)/qr/page.tsx
decisions:
  - "Used native <input type='checkbox'> for select-all instead of shadcn Checkbox — base-nova preset lacks indeterminate state (RESEARCH.md Pitfall 8)"
  - "Print grid shows selectedProducts if any are selected, otherwise shows all products"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 03 Plan 03-03: QR Management UI Summary

**One-liner:** Server Component + Client Component pair replacing /qr placeholder — checkbox selection, individual PNG download via Route Handler, and print:hidden/print:block CSS strategy for A4 QR grid printing.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Replace /qr placeholder with QR management Server Component | 6434701 | src/app/(app)/qr/page.tsx |
| 2 | Create QrManagementClient — checkbox selection, download, print | 3632252 | src/components/qr-management-client.tsx, src/app/(app)/qr/page.tsx |

## What Was Built

### `src/app/(app)/qr/page.tsx`
- Server Component — calls `requireAdmin()` first, redirecting OPERADOR to /dashboard and unauthenticated users to /login.
- Fetches all products with `select: { id, nombre }` ordered by name.
- Renders `QrManagementClient` with the products array as props.

### `src/components/qr-management-client.tsx`
- Client Component (`'use client'`).
- `useState<Set<string>>` tracks selected product IDs.
- **Screen UI** (`print:hidden`): "select all" checkbox, per-product checkboxes, "Imprimir seleccionados (N)" button (disabled when nothing selected), and per-product "PNG" download anchor.
- **Download links**: plain `<a href="/api/qr/{id}" download="qr-{name}.png">` — no JS needed, browser fetches PNG from Route Handler.
- **Print grid** (`hidden print:block`): 4-column Tailwind grid (`grid-cols-4`), shows selected products if any are selected, otherwise all products. Each cell has `<img src="/api/qr/{id}">` + product name. `break-inside-avoid` prevents QR codes from splitting across pages.
- **Empty state**: rendered when `products.length === 0` with "Sin productos activos" message.
- Uses native `<input type="checkbox">` throughout — avoids base-nova Checkbox's missing indeterminate state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `activo: true` filter from Prisma query**
- **Found during:** Task 1 — TypeScript check (`npx tsc --noEmit`)
- **Issue:** The plan specified `where: { activo: true }` but the `Product` model in `prisma/schema.prisma` has no `activo` boolean field. The model uses `alertActive` (for alert deduplication) but has no activation/deactivation concept. TypeScript error: `Object literal may only specify known properties, and 'activo' does not exist in type 'ProductWhereInput'`.
- **Fix:** Removed the `where` clause entirely — all products are returned. Added a comment explaining the discrepancy for future reference.
- **Files modified:** `src/app/(app)/qr/page.tsx`
- **Commit:** 3632252

## Known Stubs

None — the component is fully wired. Download links and print grid img src both point to the `/api/qr/[productId]` Route Handler created in Plan 03-01.

## Threat Flags

No new security-relevant surface beyond what was modeled in the plan's threat register:
- T-03-03-01: `requireAdmin()` is the first call in `QrPage` — OPERADOR redirected to /dashboard.
- T-03-03-02: `/api/qr/{id}` img src requests are authenticated via session cookie at the Route Handler level (implemented in Plan 03-01).
- T-03-03-03: `product.id` values come from `prisma.product.findMany` (server-fetched, parameterized) — not from user input.

## Self-Check: PASSED

- `src/app/(app)/qr/page.tsx`: FOUND
- `src/components/qr-management-client.tsx`: FOUND
- Commit 6434701: FOUND
- Commit 3632252: FOUND
- TypeScript check (`npx tsc --noEmit`): PASSED (exit 0)
