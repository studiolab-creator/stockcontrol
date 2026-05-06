# Phase 4: Alerts - Research

**Researched:** 2026-05-06
**Domain:** Email alerting (Resend), Prisma AppConfig model, alertActive dedup, /alertas UI
**Confidence:** HIGH

## Summary

Phase 4 is a pure integration phase with no new structural unknowns. The schema is fully defined
(`alertActive Boolean`, `AlertConfig` model), both mutation entry points are identified, and the
visual pattern is already implemented in DashboardClient. The primary new work is: (1) installing
and integrating the Resend SDK, (2) adding an `AppConfig` model to store the global recipient
email, (3) grafting alert logic into two existing Server Actions post-transaction, and (4) building
the /alertas Server Component page.

The key architectural constraint (D-04) is that email sends happen OUTSIDE the Prisma transaction.
This means the DB commit happens first (`alertActive = true`, stock updated), then Resend is called.
If Resend fails, the dedup flag prevents double sends on the next trigger, so no duplicate email
is possible even without the retry. The retry exists only to improve delivery reliability for
transient 429/500 errors.

**Primary recommendation:** Install `resend@6.12.3`, add `AppConfig` to schema via `npx prisma db push`,
implement `sendLowStockAlert()` in `src/lib/email.ts`, call it from both stock action files after
each transaction commit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Alert trigger logic | API / Backend (Server Action) | — | Lives inside existing Server Actions, server-only by design |
| Email delivery | External service (Resend) | — | Called from Server Action after DB commit |
| alertActive dedup | Database (Prisma) | API / Backend | Flag set/read in Server Actions; enforced at DB level |
| AppConfig persistence | Database (Prisma) | — | key/value row, upserted from Server Action |
| /alertas UI | Frontend Server (SSR) | — | Server Component reads DB directly; form handled by bound Server Action |
| Low-stock badge in /productos | Frontend Server (SSR) | — | Server Component renders badge from `stock <= minStock` |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** alertActive logic in BOTH `subtractStockViaQR` AND `addStockMovement`.
- **D-02:** Strict threshold: `newStock < minStock` to fire alert. `newStock === minStock` does NOT fire.
- **D-03:** `alertActive` resets to `false` automatically when `newStock > minStock` in `addStockMovement`.
- **D-04:** Email sent OUTSIDE Prisma transaction. Commit first, then call Resend. Retry on failure.
- **D-05:** Visual indicators (badge + red border) use `stock <= minStock`, unchanged from DashboardClient. `alertActive` does NOT control the visual.
- **D-06:** Visual indicators must appear on both `/dashboard` and `/productos`. Dashboard already done; `/productos` needs badge added.
- **D-07:** Single global destination email (not per-product). New `AppConfig` model needed.
- **D-08:** Email field validation must reject non-emails before saving.
- **D-09:** `/alertas` page: top section = global email config (input + save), bottom section = table of products with `alertActive=true`.
- **D-10:** `/alertas` is ADMIN only (`requireAdmin()`). Non-admin redirects to `/dashboard`.
- **D-11:** Simple HTML email format.
- **D-12:** Subject: `⚠️ Stock bajo: {nombre del producto}`.
- **D-13:** Email content: product name, current stock, min stock, movement type ("Escaneo QR" / "Entrada manual"), link to `/productos/{id}`.

### Claude's Discretion

- Exact retry count and backoff strategy for failed emails.
- How to store the global email: `AppConfig { key String @unique; value String }` or similar.
- Empty state for `/alertas` when no products have `alertActive=true`.
- Behavior when no global email is configured when an alert fires (silence or log).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 4 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALERT-01 | When stock falls below `minStock`, send email via Resend to configured recipients | Resend SDK verified at v6.12.3; `send()` API documented below |
| ALERT-02 | `alertActive` flag prevents duplicate emails — fires once per downward crossing | Pattern implemented in both action files via post-transaction Prisma update |
| ALERT-03 | `alertActive` resets to `false` when stock rises above `minStock` | Reset logic in `addStockMovement` after transaction commit |
| ALERT-04 | ADMIN can configure recipient email list via /alertas | New `AppConfig` model + Server Action with Zod `.email()` validation |
| ALERT-05 | Visual indicators in dashboard AND catalog show products with low stock | Dashboard done; `/productos` needs `stock <= minStock` badge following DashboardClient pattern |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | 6.12.3 | Transactional email delivery | Official SDK; NOT currently installed — must `npm install resend` in Wave 0 |
| zod | 4.4.1 (installed) | Email field validation | Already used across all actions; `.email()` method verified working |
| prisma | 7.8.0 (installed) | AppConfig model persistence | Already used; `db push` adds new model |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/cache` revalidatePath | built-in | Cache invalidation after mutations | After all stock mutations and after saving AppConfig |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AppConfig Prisma model | `.env` var | Env vars require redeploy to change; AppConfig is editable at runtime from UI — correct choice |
| AppConfig Prisma model | In-memory singleton | Doesn't survive restarts; DB is correct |
| Simple retry loop | Queue/worker | Phase 4 is internal tool for 3-10 people; simple retry is sufficient |

**Installation:**
```bash
npm install resend
```

**Version verification:** `npm view resend version` returned `6.12.3` on 2026-05-06.
[VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Stock Mutation (QR scan or manual entry)
        │
        ▼
┌─────────────────────────────────────────┐
│  prisma.$transaction                    │
│  ├── product.update (atomic increment)  │
│  └── movement.create                    │
└─────────────────┬───────────────────────┘
                  │ commit
                  ▼
        newStock computed from
        updated.stock (available post-tx)
                  │
        ┌─────────┴──────────┐
        │                    │
  delta < 0?           delta > 0?
  (reduction)          (addition)
        │                    │
  newStock < minStock?  newStock > minStock?
  AND alertActive=false   AND alertActive=true
        │                    │
        ▼                    ▼
  prisma.product.update   prisma.product.update
  { alertActive: true }   { alertActive: false }
        │
        ▼
  sendLowStockAlertWithRetry(product, motivo)
  ├── fetch AppConfig (global email)
  ├── if no email → log warn, return
  └── resend.emails.send(...)
        ├── success → done
        └── error 429/500 → retry (3x, 1s backoff)
```

### Recommended Project Structure (new files only)

```
src/
├── lib/
│   └── email.ts                     # sendLowStockAlertWithRetry() — server-only
├── app/(app)/alertas/
│   ├── page.tsx                     # Replace placeholder — Server Component
│   └── actions.ts                   # saveGlobalAlertEmail() Server Action
```

### Pattern 1: Resend SDK Initialization and Send

**What:** Initialize Resend client once (module-level), call `resend.emails.send()` with destructured `{ data, error }` return.
**When to use:** Inside `src/lib/email.ts` — `server-only` file.

```typescript
// Source: https://resend.com/docs/api-reference/emails/send-email
import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendLowStockAlertWithRetry(params: {
  productId: string
  productName: string
  currentStock: number
  minStock: number
  motivo: string  // 'Escaneo QR' | 'Entrada manual'
  recipientEmail: string
}): Promise<void> {
  const { data, error } = await resend.emails.send({
    from: 'StockControl <alertas@yourdomain.com>',
    to: [params.recipientEmail],
    subject: `⚠️ Stock bajo: ${params.productName}`,
    html: buildAlertEmailHtml(params),
  })
  if (error) {
    // Log but do not throw — alertActive=true already prevents duplicates
    console.error('[alert] Resend error:', error)
  }
}
```

### Pattern 2: Retry Wrapper (Claude's Discretion resolution)

**What:** 3 attempts with 1-second linear backoff. Only retry on 429 (rate limit) and 500 (server error). Use idempotency key to prevent duplicates on retry.
**Why these values:** Resend docs recommend max 3-5 retries with exponential backoff for 429/500. For an internal tool with low email volume, 3 retries with 1s linear delay is sufficient and avoids complexity.
[CITED: https://resend.com/docs/llms-full.txt — "Best Practices" section]

```typescript
// Source: https://resend.com/docs/llms-full.txt (Best Practices)
async function sendWithRetry(
  payload: Parameters<typeof resend.emails.send>[0],
  idempotencyKey: string,
  maxAttempts = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await resend.emails.send(
      { ...payload, idempotencyKey },
    )
    if (!error) return
    const isRetryable = error.statusCode === 429 || error.statusCode === 500
    if (!isRetryable || attempt === maxAttempts) {
      console.error(`[alert] Send failed after ${attempt} attempts:`, error)
      return
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
}
```

**Idempotency key pattern:** `stock-alert/${productId}` — safe because `alertActive=true` ensures this combination fires at most once per downward crossing; the key expires in 24h at Resend's end.
[CITED: https://resend.com/docs/llms-full.txt — format `<event-type>/<entity-id>`]

### Pattern 3: alertActive Post-Transaction Logic

**What:** After `prisma.$transaction` resolves, read `updated.stock` (already in scope from the tx result) and apply dedup logic WITHOUT an extra DB read.
**Critical insight:** Both existing actions already capture `updated.stock` from the tx return value. The post-transaction alert logic reuses this value — no extra SELECT needed.

```typescript
// In subtractStockViaQR — after await prisma.$transaction(...)
// updated.stock is already in scope from the tx block
// (the select: { stock: true } in tx.product.update)

// Post-commit alert logic
const product = await prisma.product.findUnique({
  where: { id: productId },
  select: { nombre: true, minStock: true, alertActive: true },
})

if (product && newStock < product.minStock && !product.alertActive) {
  // Set flag first, then send email
  await prisma.product.update({
    where: { id: productId },
    data: { alertActive: true },
  })
  const config = await prisma.appConfig.findUnique({ where: { key: 'alert_email' } })
  if (config?.value) {
    await sendLowStockAlertWithRetry({ ...product, motivo: 'Escaneo QR', recipientEmail: config.value })
  }
}
```

**Note on updated.stock:** The tx block does `select: { stock: true }` and returns `updated`. That value is available in the outer action scope after the transaction resolves. The transaction cannot return `minStock` and `alertActive` without adding them to the select — the simplest approach is one extra `findUnique` after commit, selecting only the three needed fields. This is a single indexed read (`id` PK) — negligible cost.

### Pattern 4: AppConfig Model (Claude's Discretion resolution)

**What:** Generic key/value config table. Single row with `key='alert_email'`, `value=<email>`. Supports upsert pattern cleanly.

**Recommended Prisma model:**
```prisma
model AppConfig {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

**Why `@id` on `key` instead of separate `id + @unique`:** The key IS the natural identifier; using it as PK removes a redundant UUID column and makes upsert trivially `prisma.appConfig.upsert({ where: { key: 'alert_email' }, ... })`.

**Schema push command (Neon with DIRECT_URL):**
```bash
npx prisma db push
```
(Uses `prisma.config.ts` which reads `DIRECT_URL` for DDL — see `prisma.config.ts:25`. No migration file created — `db push` is the established pattern for this project.)

### Pattern 5: saveGlobalAlertEmail Server Action

**What:** Validates email with Zod `.email()`, upserts AppConfig row, revalidates `/alertas`.

```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

const EmailSchema = z.object({
  email: z.string().email('Ingresá un email válido.'),
})

export async function saveGlobalAlertEmail(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const validated = EmailSchema.safeParse({ email: formData.get('email') })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  await prisma.appConfig.upsert({
    where: { key: 'alert_email' },
    create: { key: 'alert_email', value: validated.data.email },
    update: { value: validated.data.email },
  })
  revalidatePath('/alertas')
  return undefined
}
```

**Zod v4 `.email()` behavior:** Verified working — `z.string().email()` rejects non-emails with `"Invalid email address"` (tested against installed zod v4.4.1).
[VERIFIED: local node execution against installed zod]

### Pattern 6: /alertas Server Component

**What:** Admin-only Server Component that fetches global email config and products with `alertActive=true`.

```typescript
// src/app/(app)/alertas/page.tsx
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
// ... shadcn/ui imports

export default async function AlertasPage() {
  await requireAdmin()

  const [config, alertedProducts] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: 'alert_email' } }),
    prisma.product.findMany({
      where: { alertActive: true },
      select: { id: true, nombre: true, stock: true, minStock: true, unidad: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const globalEmail = config?.value ?? ''

  return (
    <div>
      {/* Section 1: Global email config (ADMIN only) */}
      {/* Section 2: Products with alertActive=true */}
    </div>
  )
}
```

**Empty state for products table (Claude's Discretion resolution):**
When `alertedProducts.length === 0`, show: "No hay productos con stock bajo actualmente." — same muted text + centered layout pattern used across all other empty states in the app.

**No-email-configured behavior (Claude's Discretion resolution):**
When `sendLowStockAlertWithRetry` is called and no AppConfig row exists (or `config.value` is empty), log a `console.warn('[alert] No global alert email configured — skipping email for product:', productId)` and return. No error thrown to avoid disrupting the stock mutation flow.

### Pattern 7: Low-Stock Badge in /productos Catalog

**What:** Add `stock <= minStock` badge following the exact DashboardClient pattern. `/productos/page.tsx` is a Server Component with a table — no Client Component wrapper needed. The badge can be rendered inline.

**Current state of /productos table:** Has columns `Nombre | SKU | Tipo | Categoría | Unidad | Stock mínimo | Acciones`. Currently does NOT show current stock or a low-stock indicator.

**Required change:** Add a `Stock` column (current stock + badge) to the existing table. The badge logic mirrors DashboardClient exactly:

```typescript
// In /productos/page.tsx — same isLowStock logic as DashboardClient
// isLowStock: stock <= minStock  (D-05: this threshold is INTENTIONALLY different from the alert trigger)
const isLowStock = product.stock <= product.minStock

// In the table row:
<TableCell>
  <div className="flex items-center gap-2">
    <span>{product.stock}{product.unidad ? ` ${product.unidad}` : ''}</span>
    {isLowStock && <Badge variant="destructive">Stock bajo</Badge>}
  </div>
</TableCell>
```

**The prisma query already fetches `stock` and `minStock`** — `findMany` with `include: { categoria: true }` returns the full Product model, so no query change is needed.

### Anti-Patterns to Avoid

- **Read-then-write for alertActive:** Never do `findUnique` then `update alertActive` within the transaction — this violates CLAUDE.md's atomic constraint. The alertActive update is a separate `update` OUTSIDE the transaction, which is correct.
- **Sending email inside transaction:** Never `await sendLowStockAlert()` inside `prisma.$transaction()`. If Resend hangs, the transaction stays open and holds a DB connection.
- **Checking `alertActive` inside the transaction:** The transaction does the stock arithmetic; `alertActive` check and update happen after commit.
- **Using `AlertConfig.emails[]` for global email:** The per-product `AlertConfig` model is in the schema but NOT used for this purpose (D-07). `AppConfig` is the correct model.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP client | resend SDK | TLS, bounce handling, deliverability infrastructure |
| Email validation | Custom regex | `z.string().email()` | Zod already installed; covers RFC-compliant edge cases |
| Retry with exponential backoff | Custom retry utility | Inline loop (3 attempts, 1s) is sufficient at this scale | For 3-10 users, a simple loop avoids adding a dependency |
| Config storage | File-based config | `AppConfig` Prisma model | Survives redeploys; editable from UI |

**Key insight:** Resend's idempotency key feature handles the duplicate-send risk on retries — no custom dedup tracking needed beyond what `alertActive` already provides.

---

## Common Pitfalls

### Pitfall 1: alertActive Race Condition
**What goes wrong:** Two concurrent QR scans for the same product both read `alertActive=false`, both set it to `true`, both send email → duplicate alert.
**Why it happens:** alertActive is read and written in two separate DB operations (not in the same atomic transaction as the stock update).
**How to avoid:** Use `prisma.product.updateMany` with a `WHERE alertActive = false` filter for the alertActive flip, so only one caller "wins" the update. Check the returned `count` to decide whether to send:

```typescript
const result = await prisma.product.updateMany({
  where: { id: productId, alertActive: false },  // atomic claim
  data: { alertActive: true },
})
if (result.count === 1) {
  // Only this caller won — send the email
  await sendLowStockAlertWithRetry(...)
}
```

This is a compare-and-swap pattern using the WHERE clause — at most one concurrent caller gets `count: 1`.
[ASSUMED: this CAS approach is the correct Prisma pattern for avoiding race conditions without advisory locks]

**Warning signs:** Multiple email alerts received for a single stock event.

### Pitfall 2: Transaction Scope Creep
**What goes wrong:** Developer adds `alertActive` update or email call inside `prisma.$transaction()` block.
**Why it happens:** Seems cleaner to do everything in one place.
**How to avoid:** The CLAUDE.md constraint is explicit: stock mutation = atomic SQL in transaction. alertActive and email = AFTER commit. Keep the transaction block minimal.

### Pitfall 3: AppConfig Model Not in Generated Client
**What goes wrong:** After adding `AppConfig` to schema and running `db push`, the generated client in `src/generated/prisma/` doesn't have `prisma.appConfig` — TypeScript errors.
**Why it happens:** `db push` pushes schema to DB but doesn't regenerate the Prisma client automatically.
**How to avoid:** After `npx prisma db push`, also run `npx prisma generate`. Both steps are required.

### Pitfall 4: Resend `from` Address Domain
**What goes wrong:** Email sends fail with 403 because the `from` domain isn't verified in Resend dashboard.
**Why it happens:** Resend requires domain verification before sending from custom domains.
**How to avoid:** Either use Resend's onboarding address `onboarding@resend.dev` for testing, or verify the production domain in the Resend dashboard before deploying. Document this in the Wave 0 task.

### Pitfall 5: Zod v4 Error Shape
**What goes wrong:** Error handling code uses `error.flatten().fieldErrors` but the field name in the schema is `email` — must match the form input `name="email"` exactly for error display.
**Why it happens:** Mismatch between schema field names and form input names.
**How to avoid:** Keep schema field name and `<input name="...">` identical.

---

## Code Examples

Verified patterns from official sources:

### Resend send() return shape
```typescript
// Source: https://resend.com/docs/api-reference/emails/send-email
const { data, error } = await resend.emails.send({ ... })
// data: { id: string } | null
// error: { name: string; message: string; statusCode: number } | null
```
[VERIFIED: Context7 /llmstxt/resend_llms-full_txt]

### Prisma upsert for AppConfig
```typescript
// Source: Prisma docs (established project pattern)
await prisma.appConfig.upsert({
  where: { key: 'alert_email' },
  create: { key: 'alert_email', value: email },
  update: { value: email },
})
```

### revalidatePath after mutation
```typescript
// Source: established project pattern (all existing actions use this)
import { revalidatePath } from 'next/cache'
revalidatePath('/alertas')
```

### requireAdmin pattern (for /alertas page)
```typescript
// Source: src/lib/dal.ts (verified)
import { requireAdmin } from '@/lib/dal'
export default async function AlertasPage() {
  await requireAdmin()  // redirects non-admin to /dashboard
  // ...
}
```

### Prisma client import path (project convention)
```typescript
// Source: src/lib/prisma.ts (verified)
import { prisma } from '@/lib/prisma'
// NOT: import { PrismaClient } from '@prisma/client'
// NOT: import { PrismaClient } from '@/generated/prisma'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AlertConfig.emails[]` per product | `AppConfig { key, value }` global email | Phase 4 decision (D-07) | Schema needs new model; existing `AlertConfig` model left in schema but unused by alerts |
| Placeholder /alertas page | Full Server Component | Phase 4 | Complete page replacement — no incremental addition |

**Deprecated/outdated:**
- `AlertConfig` per-product emails array: exists in schema, generated client confirms it, but D-07 explicitly says it is NOT used for the global email feature. It can remain in schema unused.

---

## Open Questions

1. **Resend `from` email address for production**
   - What we know: Resend requires a verified domain to send from a custom address
   - What's unclear: Which domain will be verified for production deployment (Railway/Render)
   - Recommendation: Use `onboarding@resend.dev` during development/testing; document that ADMIN must configure a verified domain before production use. Wave 0 task should note this.

2. **RESEND_API_KEY env var**
   - What we know: Must be set in `.env.local` (dev) and Railway/Render env vars (prod)
   - What's unclear: Whether it exists in the current `.env.local`
   - Recommendation: Wave 0 task checks for `RESEND_API_KEY` and documents where to get it (resend.com/api-keys)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| resend npm package | Email delivery (ALERT-01) | No | — | None — must install |
| RESEND_API_KEY env var | Resend initialization | Unknown | — | Dev can use test mode with `onboarding@resend.dev` |
| PostgreSQL (Neon) | AppConfig persistence | Yes (existing) | Neon managed | — |
| `npx prisma db push` | AppConfig schema migration | Yes | Prisma 7.8.0 installed | — |

**Missing dependencies with no fallback:**
- `resend` npm package — Wave 0 must `npm install resend`

**Missing dependencies with fallback:**
- `RESEND_API_KEY` — without it, Resend client throws at initialization; mitigate by checking env var presence at startup and logging a warning rather than crashing. Email silently skips if key absent.

---

## Validation Architecture

nyquist_validation is enabled (`config.json: workflow.nyquist_validation: true`).

### Test Framework

No test framework is installed in this project.
[VERIFIED: no jest.config.*, vitest.config.*, playwright.config.*, or test/ directories found at project root]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|--------|
| ALERT-01 | Email sent when stock crosses below minStock | Integration | Manual only — requires Resend API key and live DB | Wave 0 gap |
| ALERT-02 | No duplicate email when alertActive=true | Unit-like | Manual: trigger two reductions in sequence, verify only 1 email | Wave 0 gap |
| ALERT-03 | alertActive resets when stock rises above minStock | Manual | Manually add stock above minStock, verify flag in DB | Manual |
| ALERT-04 | ADMIN can save global email via /alertas | E2E / manual | Manual browser test | Manual |
| ALERT-05 | Visual badge appears in /productos for low-stock products | Manual UI | Manual browser check | Manual |

### Wave 0 Gaps

- [ ] No test framework installed — automated tests for alert logic are not feasible without adding Jest or Vitest
- [ ] Manual verification checklist needed for ALERT-01 through ALERT-05 (define in PLAN.md)

**Recommendation:** Given the project has no test infrastructure and is a 3-10 person internal tool, the validation strategy for Phase 4 is manual smoke testing: after implementation, manually trigger a stock reduction below minStock and verify (a) alertActive=true in DB, (b) email received, (c) second reduction does NOT send another email, (d) stock increase above minStock resets alertActive=false.

---

## Security Domain

security_enforcement is enabled (config.json: `security_enforcement: true`, ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `requireAdmin()` in `/alertas` page and `saveGlobalAlertEmail` action — already established pattern |
| V3 Session Management | No direct change | Handled by existing JWT middleware |
| V4 Access Control | Yes | `/alertas` and `saveGlobalAlertEmail` must call `requireAdmin()` — verified pattern from `categorias/actions.ts` |
| V5 Input Validation | Yes | Zod `.email()` on global email field — verified working |
| V6 Cryptography | No | No new secrets; `RESEND_API_KEY` is an env var (standard practice) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized alert email config change | Tampering | `requireAdmin()` in `saveGlobalAlertEmail` action — verified pattern |
| Email injection via product name in subject | Tampering | Resend SDK handles subject encoding; product names come from DB (admin-controlled), low risk |
| Unauthenticated access to /alertas | Elevation of Privilege | `requireAdmin()` at top of page component — same as `/categorias` |
| RESEND_API_KEY exposure | Information Disclosure | Env var never passed to client; `email.ts` imports `server-only` |

---

## Project Constraints (from CLAUDE.md)

All directives extracted from `CLAUDE.md` and `AGENTS.md`:

| Directive | Impact on Phase 4 |
|-----------|-------------------|
| Auth: username+password only; email NEVER for login | `saveGlobalAlertEmail` stores a notification email — confirm it never touches User model |
| Stock mutations: atomic SQL, NEVER read-then-write | alertActive update is OUTSIDE transaction; uses `updateMany` with WHERE clause for CAS |
| QR content: UUID only | No impact on Phase 4 |
| HTTPS required | No change — already enforced |
| alertActive dedup: fire once per downward crossing | Core requirement — implemented via CAS pattern in post-transaction logic |
| Ledger append-only | No new Movement logic changes; movements still created in transaction only |
| **AGENTS.md:** "Read `node_modules/next/dist/docs/` before writing any code" | Verified: Next.js 16.2.4 installed; Server Actions use `'use server'` file-level directive; `revalidatePath` from `next/cache` — all existing patterns confirmed |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/llmstxt/resend_llms-full_txt` — Resend SDK send API, error codes, retry strategy, idempotency keys
- `prisma/schema.prisma` (local file) — confirmed `alertActive Boolean @default(false)`, `AlertConfig` model structure
- `src/app/(app)/reducir/[productId]/actions.ts` (local file) — exact insertion point for QR alert logic
- `src/app/(app)/productos/[id]/actions.ts` (local file) — exact insertion point for manual entry alert logic
- `src/components/dashboard-client.tsx` (local file) — `isLowStock` helper pattern, `Badge variant="destructive"` usage
- `src/lib/dal.ts` (local file) — `requireAdmin()` pattern
- `src/lib/prisma.ts` (local file) — Prisma client import path `@/lib/prisma`
- `src/app/(app)/alertas/page.tsx` (local file) — current placeholder state confirmed
- `src/app/(app)/productos/page.tsx` (local file) — current catalog state, no stock column
- `package.json` (local file) — confirmed resend NOT installed; zod 4.4.1, prisma 7.8.0 installed
- `prisma.config.ts` (local file) — `db push` uses `DIRECT_URL`; no separate `migrate dev` needed

### Secondary (MEDIUM confidence)
- npm registry: `npm view resend version` → `6.12.3` (current as of 2026-05-06)

### Tertiary (LOW confidence)
- None

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `prisma.product.updateMany` with `WHERE alertActive = false` acts as a compare-and-swap, preventing duplicate email sends under concurrent requests | Common Pitfalls — Pitfall 1 | Two concurrent QR scans could both send alert emails. Mitigation: at 3-10 users, concurrent scans for the same product are extremely unlikely. Fallback: accept duplicate on edge case, `alertActive=true` prevents further duplicates. |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — resend version verified from registry; all other libs already installed and verified
- Architecture: HIGH — all insertion points verified from actual source files; patterns derived from existing code
- Pitfalls: MEDIUM-HIGH — race condition (A1) is partially assumed; all others are verified from code structure

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable stack — resend, prisma, Next.js are not fast-moving for this use case)
