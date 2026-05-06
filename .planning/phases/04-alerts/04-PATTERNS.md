# Phase 4: Alerts - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 6 (3 new, 3 modified)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/email.ts` | utility (server-only) | request-response | `src/lib/prisma.ts` | role-match (server-only lib module) |
| `src/app/(app)/alertas/actions.ts` | server action | request-response (CRUD) | `src/app/(app)/categorias/actions.ts` | exact (requireAdmin + Zod + upsert/create + revalidatePath) |
| `src/app/(app)/alertas/page.tsx` | server component | request-response | `src/app/(app)/usuarios/page.tsx` | exact (requireAdmin + parallel prisma queries + table + empty state) |
| `prisma/schema.prisma` | schema / config | — | `prisma/schema.prisma` (existing models) | exact (same file — add model following established conventions) |
| `src/app/(app)/reducir/[productId]/actions.ts` | server action | request-response + event | `src/app/(app)/productos/[id]/actions.ts` | exact (same file family — both are stock mutation actions) |
| `src/app/(app)/productos/[id]/actions.ts` | server action | request-response + event | `src/app/(app)/reducir/[productId]/actions.ts` | exact (same file family — both are stock mutation actions) |
| `src/app/(app)/productos/page.tsx` | server component | request-response | `src/app/(app)/productos/page.tsx` + `src/components/dashboard-client.tsx` | exact (same file modified; badge pattern from DashboardClient) |

---

## Pattern Assignments

### `src/lib/email.ts` (utility, server-only)

**Analog:** `src/lib/prisma.ts` (server-only lib module pattern)

**Server-only guard pattern** (prisma.ts lines 1-2):
```typescript
import 'server-only'
// This import makes the module server-only at the bundler level.
// Next.js will throw a build error if this file is imported from a Client Component.
```

**Module-level singleton pattern** (prisma.ts lines 5-12):
```typescript
// Module-level initialization — runs once per server process.
// New file replicates this: const resend = new Resend(process.env.RESEND_API_KEY)
// at module level, outside any function.
const globalForPrisma = global as unknown as { prisma: PrismaClient }
function createPrismaClient() { ... }
export const prisma = globalForPrisma.prisma || createPrismaClient()
```

**Prisma client import convention** (prisma.ts line 2):
```typescript
// Always import generated client from this path — NOT from '@prisma/client'
import { PrismaClient } from '@/generated/prisma/client'
```

**Key divergences for email.ts:**
- `email.ts` imports `'server-only'` the same way as `prisma.ts`
- `email.ts` also imports `prisma` from `@/lib/prisma` (to fetch `AppConfig` for the global recipient email)
- The Resend client is initialized at module level: `const resend = new Resend(process.env.RESEND_API_KEY)`
- The exported function is `sendLowStockAlertWithRetry()` — async, returns `Promise<void>`, never throws (logs and returns on failure)
- Retry loop: 3 attempts, 1 second linear backoff, only retry on `error.statusCode === 429 || error.statusCode === 500`
- CAS guard: function only sends email when called by the winner of `updateMany` (count === 1 check happens in the caller, not here)
- Idempotency key: `stock-alert/${productId}` passed to `resend.emails.send()`

---

### `src/app/(app)/alertas/actions.ts` (server action, CRUD)

**Analog:** `src/app/(app)/categorias/actions.ts`

**Imports pattern** (categorias/actions.ts lines 1-5):
```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'
```

**requireAdmin guard pattern** (categorias/actions.ts lines 16-17):
```typescript
// First line inside every admin-only Server Action — before validation.
// Redirects to /dashboard for non-admins; redirects to /login if unauthenticated.
await requireAdmin()
```

**Zod schema + safeParse pattern** (categorias/actions.ts lines 7-29):
```typescript
const CategorySchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.').max(100),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export async function createCategory(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const validated = CategorySchema.safeParse({ nombre: formData.get('nombre') })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  // ...
}
```

**revalidatePath pattern** (categorias/actions.ts line 41):
```typescript
revalidatePath('/categorias')
return undefined   // success — callers treat undefined as success
```

**Key divergences for alertas/actions.ts:**
- Schema: `z.object({ email: z.string().email('Ingresá un email válido.') })` — uses `.email()` validator
- DB operation: `prisma.appConfig.upsert({ where: { key: 'alert_email' }, create: { key: 'alert_email', value: validated.data.email }, update: { value: validated.data.email } })`
- Revalidation: `revalidatePath('/alertas')`
- ActionState type: same shape as categorias — `{ error?: string; errors?: Record<string, string[]> } | undefined`
- No try/catch needed around upsert (upsert on a unique PK cannot fail on duplicate; rethrow unexpected errors)

---

### `src/app/(app)/alertas/page.tsx` (server component, admin-only)

**Analog:** `src/app/(app)/usuarios/page.tsx` (closest: requireAdmin + prisma data fetch + table + Badge + empty state)

**Admin-only Server Component skeleton** (usuarios/page.tsx lines 1-19):
```typescript
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function UsuariosPage() {
  await requireAdmin()

  const users = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    select: { id: true, username: true, role: true },
  })
  // ...
}
```

**Empty state pattern** (usuarios/page.tsx lines 30-36):
```typescript
{users.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <h2 className="text-base font-semibold text-foreground mb-1">Sin usuarios</h2>
    <p className="text-sm text-muted-foreground mb-4">
      Creá el primer usuario para dar acceso al sistema.
    </p>
  </div>
) : (
  <Table> ... </Table>
)}
```

**Table row with Badge pattern** (usuarios/page.tsx lines 48-60):
```typescript
{users.map((user) => (
  <TableRow key={user.id}>
    <TableCell className="font-medium">{user.username}</TableCell>
    <TableCell>
      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
        {user.role === 'ADMIN' ? 'Admin' : 'Operador'}
      </Badge>
    </TableCell>
  </TableRow>
))}
```

**Key divergences for alertas/page.tsx:**
- Two parallel queries via `Promise.all`: `prisma.appConfig.findUnique({ where: { key: 'alert_email' } })` AND `prisma.product.findMany({ where: { alertActive: true }, select: { id, nombre, stock, minStock, unidad }, orderBy: { nombre: 'asc' } })`
- Top section: email config form — an `<input name="email">` bound to `saveGlobalAlertEmail` Server Action (using `useActionState` in a Client Component wrapper, or a plain `<form action={saveGlobalAlertEmail}>` if no pending state is needed)
- Bottom section: table of products with `alertActive: true` — columns: Nombre, Stock actual, Stock mínimo
- Empty state for products table (when `alertedProducts.length === 0`): `"No hay productos con stock bajo actualmente."` — same muted/centered pattern as other empty states (no action button needed)
- `Badge variant="destructive"` is NOT needed in the alertas table — it is a data table, not a visual indicator page
- Page title: `"Alertas"` following the same `text-xl font-semibold text-foreground` pattern

---

### `prisma/schema.prisma` (schema — add AppConfig model)

**Analog:** existing models in `prisma/schema.prisma`

**Existing model convention** (schema.prisma lines 53-60 — Category as minimal model):
```prisma
model Category {
  id        String    @id @default(uuid())
  nombre    String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  products  Product[]
}
```

**New model to add** (following established section header convention):
```prisma
// ─── APP CONFIG (Phase 4) ─────────────────────────────────────────────────────
// Generic key/value store for runtime-editable configuration.
// 'alert_email' key holds the global low-stock alert recipient.
// key is the PK (natural identifier) — no redundant UUID needed.

model AppConfig {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

**Critical:** After adding model and running `npx prisma db push`, also run `npx prisma generate` to regenerate the client in `src/generated/prisma/` so `prisma.appConfig` is available in TypeScript.

---

### `src/app/(app)/reducir/[productId]/actions.ts` (modify — add alertActive CAS post-transaction)

**Analog:** itself — the file is the primary reference; the modification grafts new logic after the existing `prisma.$transaction` block.

**Existing transaction + revalidatePath pattern** (reducir/actions.ts lines 37-73):
```typescript
try {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
      select: { stock: true },
    })
    if (updated.stock < 0) throw new Error('INSUFFICIENT_STOCK')
    await tx.movement.create({ data: { productId, userId: session.userId, delta, motivo: 'Escaneo QR' } })
  })

  revalidatePath('/dashboard')
  revalidatePath(`/produtos/${productId}`)
  revalidatePath('/historial')
  return { success: true }

} catch (err) {
  if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
    return { error: 'Stock insuficiente para aplicar la reducción.' }
  }
  return { error: 'Ocurrió un error. Intentá de nuevo.' }
}
```

**New code insertion point:** Between the `await prisma.$transaction(...)` call and the `revalidatePath` calls — after transaction commits, before return. The transaction block and error handler do NOT change.

**Alert logic pattern to insert** (from RESEARCH.md Pattern 3 + Pitfall 1 CAS fix):
```typescript
// Post-commit: alertActive CAS (compare-and-swap via updateMany WHERE clause)
// D-02: strict threshold — newStock < minStock (NOT <=)
// D-04: outside transaction — email after DB commit
// We need minStock to evaluate threshold; fetch it with a single indexed read.
const product = await prisma.product.findUnique({
  where: { id: productId },
  select: { nombre: true, minStock: true, alertActive: true, stock: true },
})

if (product && product.stock < product.minStock && !product.alertActive) {
  // CAS: only winner (count === 1) sends email — prevents duplicate alerts on concurrent scans
  const result = await prisma.product.updateMany({
    where: { id: productId, alertActive: false },
    data: { alertActive: true },
  })
  if (result.count === 1) {
    await sendLowStockAlertWithRetry({
      productId,
      productName: product.nombre,
      currentStock: product.stock,
      minStock: product.minStock,
      motivo: 'Escaneo QR',
    })
  }
}
```

**Note on `product.stock`:** The `findUnique` after the transaction reads the committed value. This is a single indexed PK read — negligible cost. The transaction's `updated.stock` is also in scope from the tx block return, but using `findUnique` also fetches `minStock` and `alertActive` in one round-trip.

**Import to add at top of file:**
```typescript
import { sendLowStockAlertWithRetry } from '@/lib/email'
```

**revalidatePath addition:** Also add `revalidatePath('/alertas')` after the existing revalidations, so the alertas page reflects the newly-active alert.

---

### `src/app/(app)/productos/[id]/actions.ts` (modify — add alertActive logic for manual entry)

**Analog:** `src/app/(app)/reducir/[productId]/actions.ts` — mirrors the same post-transaction pattern.

**Existing transaction pattern** (productos/[id]/actions.ts lines 43-70):
```typescript
await prisma.$transaction(async (tx) => {
  const updated = await tx.product.update({
    where: { id: productId },
    data: { stock: { increment: delta } },
    select: { stock: true },
  })
  if (updated.stock < 0) throw new Error('INSUFFICIENT_STOCK')
  await tx.movement.create({ data: { productId, userId: session.userId, delta, motivo } })
})
```

**Comment already in file** (productos/[id]/actions.ts line 57):
```typescript
// Product.alertActive is NOT touched here — managed in Phase 4 only.
```
This comment marks the exact insertion point. Remove the comment; insert alert logic below the transaction.

**Two-branch alert logic to insert** (handles both reduction and recovery):
```typescript
// Post-commit: alertActive logic (Phase 4 — D-01, D-02, D-03, D-04)
const product = await prisma.product.findUnique({
  where: { id: productId },
  select: { nombre: true, minStock: true, alertActive: true, stock: true },
})

if (product) {
  if (delta < 0 && product.stock < product.minStock && !product.alertActive) {
    // D-02: reduction crossed threshold — CAS to fire alert once
    const result = await prisma.product.updateMany({
      where: { id: productId, alertActive: false },
      data: { alertActive: true },
    })
    if (result.count === 1) {
      await sendLowStockAlertWithRetry({
        productId,
        productName: product.nombre,
        currentStock: product.stock,
        minStock: product.minStock,
        motivo: 'Entrada manual',
      })
    }
  } else if (delta > 0 && product.stock > product.minStock && product.alertActive) {
    // D-03: stock recovered above minStock — reset flag
    await prisma.product.update({
      where: { id: productId },
      data: { alertActive: false },
    })
  }
}
```

**Import to add at top of file:**
```typescript
import { sendLowStockAlertWithRetry } from '@/lib/email'
```

**revalidatePath addition:** Add `revalidatePath('/alertas')` after the existing three revalidations.

---

### `src/app/(app)/productos/page.tsx` (modify — add Stock column with low-stock badge)

**Analog:** `src/components/dashboard-client.tsx` (badge pattern) + `src/app/(app)/productos/page.tsx` itself (table structure)

**isLowStock and Badge pattern** (dashboard-client.tsx lines 49, 112-114):
```typescript
// isLowStock uses <= (D-05: intentionally different from alert trigger which uses <)
const isLowStock = (p: Product) => p.stock <= p.minStock

// Badge rendered conditionally — same variant="destructive" as dashboard
{low && (
  <Badge variant="destructive">Stock bajo</Badge>
)}
```

**Stock display with unit pattern** (dashboard-client.tsx lines 121-125):
```typescript
<p className="text-sm text-foreground">
  Stock actual:{' '}
  <span className="font-medium">
    {product.stock}{product.unidad ? ` ${product.unidad}` : ''}
  </span>
</p>
```

**Existing table header to modify** (productos/page.tsx lines 51-59):
```typescript
<TableHeader>
  <TableRow>
    <TableHead>Nombre</TableHead>
    <TableHead>SKU</TableHead>
    <TableHead>Tipo</TableHead>
    <TableHead>Categoría</TableHead>
    <TableHead>Unidad</TableHead>
    <TableHead>Stock mínimo</TableHead>
    {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
  </TableRow>
</TableHeader>
```

**New TableHead and TableCell to add** — insert a `Stock` column between `Unidad` and `Stock mínimo` (per UI-SPEC.md and CONTEXT.md D-06):

Header addition:
```typescript
<TableHead>Stock</TableHead>
```

Row cell addition (after the `unidad` cell, before the `minStock` cell):
```typescript
<TableCell>
  <div className="flex items-center gap-2">
    <span>{product.stock}{product.unidad ? ` ${product.unidad}` : ''}</span>
    {product.stock <= product.minStock && (
      <Badge variant="destructive">Stock bajo</Badge>
    )}
  </div>
</TableCell>
```

**No query change needed:** `prisma.product.findMany({ include: { categoria: true } })` already returns the full Product model, which includes `stock` and `minStock`. No `select` narrowing is needed; both fields are already available.

**No new imports needed:** `Badge` is already imported in `productos/page.tsx` (line 13).

---

## Shared Patterns

### Authentication — requireAdmin()
**Source:** `src/lib/dal.ts` (lines 26-32)
**Apply to:** `alertas/page.tsx` (first line of component body), `alertas/actions.ts` (first line of action body)
```typescript
// Redirects to /dashboard for OPERADOR; redirects to /login if unauthenticated.
// Must be called before any data access or business logic.
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getAuthenticatedUser()
  if (session.role !== 'ADMIN') redirect('/dashboard')
  return session
}
```

### Authentication — getAuthenticatedUser()
**Source:** `src/lib/dal.ts` (lines 13-19)
**Apply to:** `reducir/[productId]/actions.ts` and `productos/[id]/actions.ts` (already present — no change)
```typescript
// Already used in both stock mutation actions — first call in each action.
// The alert logic added post-transaction does NOT need to re-call this.
export async function getAuthenticatedUser(): Promise<SessionPayload> {
  const session = await verifySession()
  if (!session) redirect('/login')
  return session
}
```

### ActionState type
**Source:** `src/app/(app)/categorias/actions.ts` (line 11) and `src/app/(app)/reducir/[productId]/actions.ts` (lines 12-14)
**Apply to:** `alertas/actions.ts`
```typescript
// Both shapes are in use — use the simpler categorias shape for alertas/actions.ts
// (no 'success' flag needed — the form just clears the error on success)
type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined
```

### Zod validation + safeParse
**Source:** `src/app/(app)/categorias/actions.ts` (lines 7-29)
**Apply to:** `alertas/actions.ts`
```typescript
// Schema definition at module level; safeParse inside action; early return on failure.
const Schema = z.object({ ... })
const validated = Schema.safeParse({ field: formData.get('field') })
if (!validated.success) return { errors: validated.error.flatten().fieldErrors }
```

### revalidatePath after mutation
**Source:** `src/app/(app)/categorias/actions.ts` (line 41), `src/app/(app)/reducir/[productId]/actions.ts` (lines 69-72)
**Apply to:** All modified actions — `alertas/actions.ts`, `reducir/actions.ts`, `productos/[id]/actions.ts`
```typescript
import { revalidatePath } from 'next/cache'
// Call after successful mutation, before return.
revalidatePath('/alertas')
```

### Prisma client import
**Source:** `src/lib/prisma.ts` (line 8) — consistently used across all action files
**Apply to:** All new/modified files that touch the DB
```typescript
import { prisma } from '@/lib/prisma'
// NOT: import { PrismaClient } from '@prisma/client'
// NOT: import { PrismaClient } from '@/generated/prisma'
```

### Empty state pattern
**Source:** `src/app/(app)/usuarios/page.tsx` (lines 30-36), `src/app/(app)/productos/page.tsx` (lines 37-46)
**Apply to:** `alertas/page.tsx` products-in-alert table section
```typescript
{items.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
  </div>
) : (
  <Table> ... </Table>
)}
```
For alertas: `"No hay productos con stock bajo actualmente."` — no action button in the empty state.

---

## No Analog Found

All files have close analogs in the codebase. The one truly new capability is the Resend SDK integration in `src/lib/email.ts` — there is no existing email-sending code. The RESEARCH.md patterns (Patterns 1 and 2) are the authoritative reference for that file.

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/email.ts` (Resend integration) | utility | request-response | No email-sending code exists in the project. Use RESEARCH.md Pattern 1 (Resend SDK init) and Pattern 2 (retry wrapper). The `server-only` + module-level init pattern IS borrowed from `src/lib/prisma.ts`. |

---

## Metadata

**Analog search scope:** `src/app/(app)/`, `src/lib/`, `src/components/`, `prisma/`
**Files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-05-06
