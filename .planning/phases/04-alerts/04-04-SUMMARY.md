---
phase: 04-alerts
plan: "04"
subsystem: alerts-page
tags: [server-action, admin-ui, email-config, alert-status]
dependency_graph:
  requires: ["04-00", "04-02", "04-03"]
  provides: ["alertas-page", "saveGlobalAlertEmail-action"]
  affects: ["prisma.appConfig", "prisma.product.alertActive"]
tech_stack:
  added: []
  patterns:
    - "useActionState + submittedRef pattern for success/error toasts"
    - "Promise.all() parallel server-side data fetches"
    - "Zod .email() field validation with Spanish error message"
    - "AppConfig upsert for global key-value settings"
key_files:
  created:
    - src/app/(app)/alertas/actions.ts
    - src/app/(app)/alertas/alertas-email-form.tsx
  modified:
    - src/app/(app)/alertas/page.tsx
decisions:
  - "Success state detection uses submittedRef.current + state===undefined + !pending (mirrors category-dialog.tsx pattern)"
  - "Server action returns undefined on success (not {success:true}) — consistent with categorias/actions.ts"
  - "Form wraps formAction in arrow function to set submittedRef.current=true before calling"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-06T21:58:46Z"
  tasks_completed: 2
  files_created: 3
---

# Phase 4 Plan 04: Alertas Page Summary

Full /alertas Server Component page with ADMIN-only email config form and alertActive products table, backed by saveGlobalAlertEmail Server Action with Zod validation and AppConfig upsert.

## What Was Built

### Task 1: saveGlobalAlertEmail Server Action (`alertas/actions.ts`)

- `'use server'` module with `requireAdmin()` as first call (T-04-02 mitigation)
- Zod `EmailSchema` with `.email('Ingresá un email válido.')` — rejects non-email before DB
- `prisma.appConfig.upsert` with `key='alert_email'` — creates or updates global recipient
- `revalidatePath('/alertas')` on success
- Returns `undefined` on success; error object on Zod failure or DB error

### Task 2a: AlertasEmailForm Client Component (`alertas-email-form.tsx`)

- `'use client'` directive; `useActionState<ActionState, FormData>` binding
- `submittedRef` pattern (from category-dialog.tsx): tracks whether submit was made to distinguish initial `undefined` state from post-success `undefined` state
- `toast.success('Email guardado')` fires when `submittedRef.current && state===undefined && !pending`
- `toast.error('No se pudo guardar. Intentá de nuevo.')` fires on `state?.error`
- Inline field error: `state?.errors?.email?.[0]` rendered as `text-sm text-destructive`
- `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` shown while `pending`
- Input `defaultValue={currentEmail}` — pre-filled from server-fetched AppConfig

### Task 2b: AlertasPage Server Component (`alertas/page.tsx`)

- Replaces "Próximamente" placeholder entirely
- `await requireAdmin()` as first statement — OPERADOR redirected to /dashboard
- `Promise.all([appConfig, alertedProducts])` parallel fetches
- Section 1: email config with description + `<AlertasEmailForm>`
- `<Separator>` between sections
- Section 2: alertActive products table (Nombre | Stock actual | Stock mínimo)
- Empty state "Todo en orden / No hay productos con stock bajo actualmente." when `alertedProducts.length === 0`
- Stock cells: `{stock}{unidad ? ' ' + unidad : ''}` format

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors)
- `npm run build`: Pre-existing failure in `/productos/[id]` — `Missing API key` for Resend SDK. This error existed before this plan's commits (confirmed by stash test). Out of scope for this plan — tracked as deferred.
- All acceptance criteria satisfied:
  - `requireAdmin` present in both actions.ts and page.tsx
  - `appConfig.upsert` with `key='alert_email'` in actions.ts
  - `alertActive: true` query in page.tsx
  - `useActionState`, `saveGlobalAlertEmail`, `Loader2`, `toast.success`, `toast.error` all present in form

## Known Stubs

None — all data is wired to live Prisma queries.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

- src/app/(app)/alertas/actions.ts: FOUND
- src/app/(app)/alertas/alertas-email-form.tsx: FOUND
- src/app/(app)/alertas/page.tsx: FOUND (no longer contains "Próximamente")
- Commits 89b15f7, 5271ecc: FOUND in git log
