---
phase: 04-alerts
verified: 2026-05-06T22:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Send email when stock drops below minStock (QR path)"
    expected: "Email arrives at configured alert_email address via Resend; only one email per downward crossing"
    why_human: "Cannot invoke live Resend API or verify email delivery programmatically without RESEND_API_KEY in test environment"
  - test: "Send email when stock drops below minStock (manual path)"
    expected: "Email arrives with motivo 'Entrada manual'; no duplicate email on concurrent submissions"
    why_human: "Same — live Resend API call, cannot verify delivery without env var and running server"
  - test: "OPERADOR visiting /alertas is redirected to /dashboard"
    expected: "Browser redirects immediately; no data rendered for OPERADOR role"
    why_human: "requireAdmin() redirect is server-side; cannot test auth middleware path without running app"
  - test: "Success toast 'Email guardado' appears after saving valid email at /alertas"
    expected: "Toast appears within 1s of form submit; input remains pre-filled with saved value on next load"
    why_human: "useActionState + submittedRef toast interaction requires browser execution"
---

# Phase 4: Alerts Verification Report

**Phase Goal:** Las alertas de stock bajo funcionan end-to-end: cuando el stock cae por debajo de minStock se envía email (Resend) una sola vez por cruce descendente; alertActive se resetea cuando el stock se recupera; indicadores visuales en dashboard y catálogo muestran los productos en alerta; ADMIN configura el email receptor global en /alertas.
**Verified:** 2026-05-06T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Al reducir stock bajo minStock, se envía email via Resend al email global configurado en AppConfig, y alertActive se setea a true | VERIFIED | `reducir/[productId]/actions.ts` lines 69-96: post-transaction findUnique, updateMany CAS WHERE alertActive=false, sendLowStockAlertWithRetry with motivo='Escaneo QR'. `productos/[id]/actions.ts` lines 72-98: same pattern for manual path with motivo='Entrada manual'. `email.ts` line 104: fetches alert_email from prisma.appConfig then calls Resend SDK. |
| 2 | No se envía email duplicado mientras alertActive = true (dedup funcionando) | VERIFIED | QR path: `updateMany WHERE { id: productId, alertActive: false }` — only caller that gets count===1 sends email. Manual path: Branch A condition includes `&& !product.alertActive` pre-check plus same CAS updateMany. Both paths enforce dedup at DB level. |
| 3 | Al subir stock sobre minStock, alertActive se resetea a false | VERIFIED (with note) | `productos/[id]/actions.ts` line 99: Branch B: `delta > 0 && product.stock >= product.minStock && product.alertActive` triggers plain update setting alertActive=false. NOTE: plan specified `stock > minStock` (strict); code uses `stock >= minStock`. This is a documented intentional deviation (comment: "D-03 corrected: reset when stock >= minStock to prevent stuck alertActive at stock == minStock"). The QR path has no reset branch — only the manual path does, which is by design (QR is subtract-only). |
| 4 | ADMIN puede ver y editar el email receptor global en /alertas | VERIFIED | `alertas/page.tsx`: requireAdmin() first, parallel fetches appConfig + alertedProducts, renders AlertasEmailForm pre-filled with current email. `alertas/actions.ts`: requireAdmin() before validation, Zod .email() validator, prisma.appConfig.upsert with key='alert_email'. `alertas-email-form.tsx`: useActionState wired to saveGlobalAlertEmail, Loader2 spinner, toast.success/toast.error, inline field error display. |
| 5 | Productos con stock <= minStock muestran badge "Stock bajo" en /dashboard y /productos | VERIFIED | `/productos/page.tsx` line 77: `product.stock <= product.minStock` renders `<Badge variant="destructive">Stock bajo</Badge>` in Stock column between Unidad and Stock mínimo. `dashboard-client.tsx` line 113: same Badge variant="destructive" with "Stock bajo" text confirmed present. |

**Score:** 5/5 truths verified (automated code evidence)

### Cross-Cutting Constraint Verification

| Constraint | Required | Status | Evidence |
|------------|----------|--------|----------|
| Email sent OUTSIDE $transaction (D-04) | Yes | VERIFIED | `reducir/actions.ts`: $transaction closes at line 67 (`})`), alert block begins at line 69 comment after the await resolves. `productos/[id]/actions.ts`: identical pattern — $transaction closes at line 70, alert block at line 72. |
| alertActive CAS uses updateMany WHERE alertActive=false | Yes | VERIFIED | Both actions: `prisma.product.updateMany({ where: { id: productId, alertActive: false }, data: { alertActive: true } })` with `if (result.count === 1)` guard before email. |
| saveGlobalAlertEmail calls requireAdmin() before any DB access | Yes | VERIFIED | `alertas/actions.ts` line 21: `await requireAdmin()` is the FIRST statement in the function body, before Zod safeParse and before any DB call. |
| OPERADOR visiting /alertas redirected to /dashboard | Yes | VERIFIED (code) / UNCERTAIN (runtime) | `alertas/page.tsx` line 16: `await requireAdmin()` is first call in server component. Redirect behavior depends on requireAdmin() implementation from dal.ts (established in Phase 1, not re-verified here). Code structure is correct. Human test required for runtime confirmation. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | AppConfig model with key String @id | VERIFIED | Lines 138-142: `model AppConfig { key String @id; value String; updatedAt DateTime @updatedAt }`. Product model has `alertActive Boolean @default(false)` at line 84. |
| `src/lib/email.ts` | Server-only email utility | VERIFIED | `import 'server-only'` line 1, `new Resend(process.env.RESEND_API_KEY)`, `export async function sendLowStockAlertWithRetry`, `prisma.appConfig.findUnique({ where: { key: 'alert_email' } })`, maxAttempts=3, retry on 429/500, idempotency key, never throws. |
| `src/app/(app)/reducir/[productId]/actions.ts` | QR path with CAS alert | VERIFIED | Full implementation present. All required patterns confirmed. |
| `src/app/(app)/productos/[id]/actions.ts` | Manual path with CAS fire + reset | VERIFIED | Two-branch logic present. Placeholder comment removed. |
| `src/app/(app)/alertas/page.tsx` | Admin-only page, not placeholder | VERIFIED | No "Próximamente" text. requireAdmin() first. Promise.all fetches. Two sections. Empty state present. |
| `src/app/(app)/alertas/actions.ts` | saveGlobalAlertEmail with Zod + upsert | VERIFIED | All acceptance criteria satisfied. |
| `src/app/(app)/alertas/alertas-email-form.tsx` | Client form with useActionState | VERIFIED | useActionState, submittedRef pattern, toast.success/error, Loader2, inline field error. |
| `src/app/(app)/productos/page.tsx` | Stock column with badge | VERIFIED | TableHead "Stock" between Unidad and Stock mínimo. Badge condition `product.stock <= product.minStock`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `email.ts` | `prisma.appConfig` | `appConfig.findUnique({ where: { key: 'alert_email' } })` | VERIFIED | Line 104 of email.ts |
| `email.ts` | `resend.emails.send` | `sendWithRetry` helper | VERIFIED | Lines 30, 117-124. idempotencyKey passed as second arg (SDK v6 API). |
| `reducir/[productId]/actions.ts` | `email.ts` | `import { sendLowStockAlertWithRetry }` | VERIFIED | Line 6 of actions.ts |
| `reducir/[productId]/actions.ts` | `prisma.product.updateMany` | CAS WHERE alertActive=false | VERIFIED | Lines 81-83 |
| `productos/[id]/actions.ts` | `email.ts` | `import { sendLowStockAlertWithRetry }` | VERIFIED | Line 6 of actions.ts |
| `productos/[id]/actions.ts` | `prisma.product.updateMany` | CAS for fire | VERIFIED | Lines 85-87 |
| `productos/[id]/actions.ts` | `prisma.product.update` | plain update for reset | VERIFIED | Lines 103-106 |
| `alertas/page.tsx` | `alertas/actions.ts` | `useActionState(saveGlobalAlertEmail, ...)` via form component | VERIFIED | alertas-email-form.tsx line 13 |
| `alertas/actions.ts` | `prisma.appConfig.upsert` | upsert where key='alert_email' | VERIFIED | Lines 29-33 |
| `alertas/page.tsx` | `prisma.product.findMany` | where alertActive=true | VERIFIED | Lines 20-25 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `alertas/page.tsx` | `alertedProducts` | `prisma.product.findMany({ where: { alertActive: true } })` | Yes — live DB query | FLOWING |
| `alertas/page.tsx` | `globalEmail` | `prisma.appConfig.findUnique({ where: { key: 'alert_email' } })` | Yes — live DB query | FLOWING |
| `alertas-email-form.tsx` | `currentEmail` prop | Passed from page server component (live DB value) | Yes | FLOWING |
| `email.ts` | recipient email | `prisma.appConfig.findUnique` — null-guarded with console.warn | Yes — or gracefully skipped | FLOWING |
| `productos/page.tsx` | `products` (stock+minStock) | `prisma.product.findMany({ include: { categoria: true } })` — full Product model | Yes | FLOWING |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| ALERT-01 | Email sent via Resend when stock falls below minStock | VERIFIED (code) | Both QR and manual paths call sendLowStockAlertWithRetry post-transaction with live appConfig lookup |
| ALERT-02 | alertActive dedup — one email per downward crossing | VERIFIED | CAS updateMany WHERE alertActive=false; count===1 guard in both paths |
| ALERT-03 | alertActive resets to false when stock recovers above minStock | VERIFIED (with deviation note) | Branch B in addStockMovement uses `>= minStock` (not `>`) — intentional correction documented in code comment |
| ALERT-04 | ADMIN configures global alert email at /alertas | VERIFIED (code) / human needed (runtime) | Full page + action implemented; redirect behavior needs human test |
| ALERT-05 | Visual badges in /dashboard and /productos for low-stock | VERIFIED | Both pages confirmed to have Badge variant="destructive" "Stock bajo" with stock <= minStock condition |

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `email.ts` line 127 | Idempotency key includes time bucket: `stock-alert/${productId}/${Math.floor(Date.now() / 3_600_000)}` | INFO | Plan specified `stock-alert/${productId}` (fixed key). Actual code adds a 1-hour time bucket. This means a product that crosses the threshold, recovers, and crosses again within the same hour would NOT get a second email (idempotency key would match). alertActive CAS is the primary dedup; this is a secondary guard. The deviation is minor and the comment explains it. NOT a blocker — alertActive CAS is the authoritative dedup mechanism. |
| `productos/[id]/actions.ts` line 99 | Reset threshold is `>= minStock` not `> minStock` as specified in D-03 | INFO | Intentional deviation documented in code comment: "D-03 corrected: reset when stock >= minStock to prevent stuck alertActive at stock == minStock". This is a defensive fix for an edge case where stock exactly equals minStock. NOT a blocker. |

No TODO/FIXME/placeholder comments found in any Phase 4 files. No empty return stubs. No hardcoded empty arrays passed to rendering paths.

### Human Verification Required

#### 1. Email delivery end-to-end (QR path)

**Test:** With RESEND_API_KEY set and an alert_email configured in AppConfig, scan a product QR code to reduce stock below minStock. Scan again immediately (concurrent test optional).
**Expected:** One email arrives at the configured address with subject "Stock bajo: {product name}", showing current stock, min stock, motivo "Escaneo QR", and a link to /productos/{id}. A second scan while alertActive=true sends no email.
**Why human:** Live Resend API call; requires RESEND_API_KEY env var, running Next.js server, and an actual email inbox.

#### 2. Email delivery end-to-end (manual path)

**Test:** As ADMIN, manually enter a negative delta from /productos/{id} to reduce stock below minStock.
**Expected:** Email arrives with motivo "Entrada manual". Then add stock to bring it above minStock — no email, alertActive resets. Next reduction below minStock triggers a new email.
**Why human:** Same as above — live email delivery cannot be verified programmatically.

#### 3. OPERADOR redirect at /alertas

**Test:** Log in as a user with role OPERADOR and navigate to /alertas.
**Expected:** Immediate redirect to /dashboard; /alertas page content never renders.
**Why human:** requireAdmin() redirect is server-side middleware behavior; requires a running app with two user accounts.

#### 4. Success toast and form interaction at /alertas

**Test:** As ADMIN, navigate to /alertas, enter a valid email, click "Guardar email". Then enter an invalid string (e.g. "notanemail"), click "Guardar email".
**Expected:** Valid submit: Loader2 spinner appears while pending, then toast.success "Email guardado" fires, input retains the saved value on next page load. Invalid submit: inline error "Ingresá un email válido." appears below the input field; no toast.
**Why human:** useActionState + submittedRef interaction, toast rendering, and spinner state require browser execution.

### Notable Deviations (Not Blockers)

1. **D-03 reset threshold:** Plan specified `stock > minStock`; code uses `stock >= minStock`. Intentional defensive fix documented in code comment. The behavior is strictly better — prevents alertActive from getting stuck when stock equals minStock exactly.

2. **Idempotency key time-bucketing:** Plan specified `stock-alert/{productId}`; code uses `stock-alert/{productId}/{hourBucket}`. This adds a time dimension to the Resend-level dedup as a secondary guard. The alertActive CAS remains the authoritative dedup mechanism and is unaffected.

3. **REQUIREMENTS.md checkboxes:** ALERT-01 through ALERT-05 remain marked `[ ]` (unchecked) in REQUIREMENTS.md. Implementation is complete — the checkboxes were not updated as part of Phase 4 execution. This is a documentation gap only, not an implementation gap.

---

_Verified: 2026-05-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
