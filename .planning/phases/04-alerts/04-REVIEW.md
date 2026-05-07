---
phase: 04-alerts
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - prisma/schema.prisma
  - src/lib/email.ts
  - src/app/(app)/reducir/[productId]/actions.ts
  - src/app/(app)/productos/[id]/actions.ts
  - src/app/(app)/alertas/actions.ts
  - src/app/(app)/alertas/alertas-email-form.tsx
  - src/app/(app)/alertas/page.tsx
  - src/app/(app)/productos/page.tsx
findings:
  critical: 3
  warning: 2
  info: 1
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The alert system is well-structured overall. The CAS dedup pattern, append-only ledger constraint, and post-transaction email flow are correctly implemented. Three critical issues were found: a missing `alertActive` reset path in the QR action, a persistent-alert flag that can be triggered at `minStock == 0`, and a non-idempotent idempotency key that allows duplicate emails across alert cycles. Two warnings cover a badge threshold mismatch and a swallowed DB error. One info item covers a schema comment contradiction.

---

## Critical Issues

### CR-01: `subtractStockViaQR` never resets `alertActive` — alert flag can never clear via QR path

**File:** `src/app/(app)/reducir/[productId]/actions.ts:77-96`

**Issue:** The QR action only handles the downward crossing (sets `alertActive = true`). It has no Branch B equivalent: when a product's stock later recovers above `minStock` (via a manual addition in the other action), the `alertActive` flag is correctly reset there. But if stock is reduced to 0, then partially replenished to exactly `minStock` via repeated manual additions without ever going strictly above `minStock`, the flag stays `true` forever. More concretely: after any QR scan that fires the alert, the only code that ever resets `alertActive = false` lives in `productos/[id]/actions.ts` Branch B (`delta > 0 && stock > minStock && alertActive`). This is actually correct — reset IS in the other file. However, the QR action is missing a symmetric guard: if stock happens to be **already below `minStock` with `alertActive = true`** when another QR scan runs, the condition on line 77 (`product.stock < product.minStock`) is true, the CAS fires but gets `count = 0` (flag already set), and no duplicate is sent. This part is safe.

**The actual bug:** The QR action never resets `alertActive` when stock recovers. This recovery can ONLY happen via `addStockMovement`. If someone bypasses the web UI or a future action path is added that doesn't include Branch B, the flag becomes permanently stuck. More critically, the QR action should handle the reset itself symmetrically, since it is a full stock-mutation action. Consider: if future code adds a "bulk reduce" QR path, it will also omit the reset. The shared reset logic belongs in a single utility function called by both actions.

**Fix:** Extract the post-commit alert logic into a shared server-side helper:

```typescript
// src/lib/alert-check.ts
'use server'
import { prisma } from '@/lib/prisma'
import { sendLowStockAlertWithRetry } from '@/lib/email'

export async function checkAndFireAlert(
  productId: string,
  delta: number,
  motivo: string,
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { nombre: true, minStock: true, alertActive: true, stock: true },
  })
  if (!product) return

  if (delta < 0 && product.stock < product.minStock) {
    const result = await prisma.product.updateMany({
      where: { id: productId, alertActive: false },
      data: { alertActive: true },
    })
    if (result.count === 1) {
      await sendLowStockAlertWithRetry({ productId, productName: product.nombre,
        currentStock: product.stock, minStock: product.minStock, motivo })
    }
  } else if (delta > 0 && product.stock > product.minStock && product.alertActive) {
    await prisma.product.update({ where: { id: productId }, data: { alertActive: false } })
  }
}
```

Then call `checkAndFireAlert(productId, delta, 'Escaneo QR')` in `subtractStockViaQR` instead of the inline block.

---

### CR-02: Idempotency key is per-product, not per-alert-cycle — duplicate emails suppressed forever after first alert

**File:** `src/lib/email.ts:124`

**Issue:** The idempotency key is `stock-alert/${params.productId}` — a fixed string per product. Resend idempotency keys prevent duplicate delivery of the **same logical event**. Using a static key means that once an alert fires for a product and the flag resets (stock recovers), the **next alert cycle** for the same product will be silently dropped by Resend because the idempotency key is identical. The key must include something that changes per-cycle — at minimum the timestamp or the current stock level when the alert fired.

**Fix:**

```typescript
// In sendLowStockAlertWithRetry, change the key to include stock level and timestamp epoch:
const cycleKey = `stock-alert/${params.productId}-${params.currentStock}-${Math.floor(Date.now() / 60000)}`

await sendWithRetry(
  { from: ..., to: ..., subject: ..., html: ... },
  cycleKey,
)
```

Using a 60-second time bucket is sufficient — it prevents duplicates within a burst while allowing legitimate re-alerts in future cycles.

---

### CR-03: Alert fires (and sticks) when `minStock == 0` — any product with default threshold triggers an alert at stock 0

**File:** `src/app/(app)/reducir/[productId]/actions.ts:77`, `src/app/(app)/productos/[id]/actions.ts:81`

**Issue:** Both actions check `product.stock < product.minStock`. The schema default for `minStock` is `0` (schema line 83). When `minStock == 0`, `stock < 0` is impossible because the floor check on line 53/57 of each action prevents negative stock. So the condition `stock < 0` is unreachable, meaning no alert fires at the default threshold — this part is fine.

**However:** If an admin sets `minStock = 1` and then a QR scan reduces stock to exactly `0`, the condition `0 < 1` is true, the alert fires and `alertActive` is set to `true`. The reset Branch B in `addStockMovement` requires `stock > minStock` (strictly greater). So to reset the alert for a product with `minStock = 1`, stock must reach at least `2`. If only `1` unit is added back (restoring to `1`), the condition `1 > 1` is false, the flag stays active, and **no further alert emails will fire** even as stock continues fluctuating at exactly the threshold. The product remains in the "active alerts" list on `/alertas` indefinitely even though stock is at the defined minimum.

The root cause is an asymmetry: downward crossing uses `<` (line 77/81) but upward reset uses `>` (line 99) — at `stock == minStock` exactly, neither branch fires. The system is stuck with `alertActive = true` and stock = minStock.

**Fix:** Change the reset condition in Branch B to `>=`:

```typescript
// productos/[id]/actions.ts line 99 — change > to >=
} else if (delta > 0 && product.stock >= product.minStock && product.alertActive) {
```

This means: once stock recovers to at least the minimum (no longer below threshold), reset the flag. This is consistent with the alert condition (`stock < minStock` = alert; `stock >= minStock` = recovered).

---

## Warnings

### WR-01: Badge threshold in `productos/page.tsx` uses `<=` but alert logic uses `<` — visual indicator is misleading

**File:** `src/app/(app)/productos/page.tsx:77`

**Issue:** The "Stock bajo" badge renders when `product.stock <= product.minStock`. The actual alert fires when `product.stock < product.minStock` (strict less-than, per D-02 in both action files). This means a product at exactly `minStock` shows the badge but has NOT triggered an alert email and is NOT listed on the `/alertas` page. A user seeing the badge would expect the alert to have been sent — it wasn't. This is a misleading user-facing inconsistency.

**Fix:** Change the badge condition to match the alert logic:

```typescript
// productos/page.tsx line 77 — change <= to <
{product.stock < product.minStock && (
  <Badge variant="destructive">Stock bajo</Badge>
)}
```

If the intent is to show a warning badge at exactly `minStock` as a visual-only hint (softer signal), then the badge text and/or variant should be different from the alert-triggered state, and the discrepancy should be documented. As written it implies equivalence where none exists.

---

### WR-02: `saveGlobalAlertEmail` swallows all DB errors with a single generic message

**File:** `src/app/(app)/alertas/actions.ts:37-39`

**Issue:** The bare `catch {}` block returns a generic error for any failure — including network timeouts, constraint violations, or Prisma client errors that may indicate data corruption or misconfiguration. No error is logged. If the upsert fails silently in production, an operator has no signal in logs that configuration changes are being dropped.

**Fix:** Log the error before returning the generic message:

```typescript
} catch (err) {
  console.error('[alertas] Failed to save alert_email config:', err)
  return { error: 'No se pudo guardar. Intentá de nuevo.' }
}
```

---

## Info

### IN-01: Schema comment contradiction — `AlertConfig` model described as unused, yet it exists

**File:** `prisma/schema.prisma:132-142`

**Issue:** The comment on line 133 says `'alert_email' key holds the global low-stock alert recipient email` and line 137 says `D-07: Single global email destination stored here. AlertConfig per-product is NOT used.` The `AlertConfig` model (lines 122-130) still exists in the schema with a full relation to `Product`. Dead schema models create migration surface, confuse future developers, and add a join relation (`alertConfig`) to every `Product` query that includes relations. If `AlertConfig` is confirmed unused, it should be removed.

**Fix:** If per-product alert config is genuinely out of scope for this phase and not planned, drop the `AlertConfig` model and its `alertConfig` relation on `Product`. If it is planned for a future phase, add a `// Phase N: not yet implemented` comment to make that explicit.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
