# Phase 3: QR Workflow - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 9 new/modified files
**Analogs found:** 8 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(app)/qr/page.tsx` | page (Server Component) | request-response | `src/app/(app)/dashboard/page.tsx` | exact |
| `src/app/(app)/escanear/page.tsx` | page (Server Component) | request-response | `src/app/(app)/dashboard/page.tsx` | exact |
| `src/app/(app)/reducir/[productId]/page.tsx` | page (Server Component) | request-response | `src/app/(app)/productos/[id]/page.tsx` | exact |
| `src/app/(app)/reducir/[productId]/actions.ts` | server action | CRUD / atomic mutation | `src/app/(app)/productos/[id]/actions.ts` | exact |
| `src/app/api/qr/[productId]/route.ts` | route handler | request-response (binary I/O) | none — first Route Handler in codebase | no analog |
| `src/components/qr-management-client.tsx` | client component | request-response + event-driven | `src/components/dashboard-client.tsx` | role-match |
| `src/components/qr-scanner-client.tsx` | client component | event-driven (camera stream) | `src/components/stock-movement-dialog.tsx` | partial |
| `src/app/(app)/reducir/[productId]/not-found.tsx` | error boundary | request-response | `src/app/(app)/productos/[id]/page.tsx` (notFound() call) | partial |
| `src/components/app-sidebar.tsx` (modify) | nav (Server Component) | request-response | self | exact |
| `src/components/bottom-nav.tsx` (modify) | nav (Client Component) | event-driven | self | exact |

---

## Pattern Assignments

### `src/app/(app)/qr/page.tsx` (Server Component — replace placeholder)

**Analog:** `src/app/(app)/dashboard/page.tsx`

**Imports pattern** (`src/app/(app)/dashboard/page.tsx` lines 1-3):
```typescript
import { getAuthenticatedUser } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from '@/components/dashboard-client'
```
For the QR page, swap the last import:
```typescript
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { QrManagementClient } from '@/components/qr-management-client'
```

**Auth pattern** (`src/app/(app)/dashboard/page.tsx` line 6 — use `requireAdmin` instead of `getAuthenticatedUser`):
```typescript
export default async function QrPage() {
  await requireAdmin()   // redirects to /dashboard if not ADMIN
  // ...
}
```

**Prisma fetch pattern** (`src/app/(app)/dashboard/page.tsx` lines 8-16):
```typescript
const products = await prisma.product.findMany({
  where: { activo: true },
  select: { id: true, nombre: true },
  orderBy: { nombre: 'asc' },
})
```

**Render pattern** (`src/app/(app)/dashboard/page.tsx` lines 19-27):
```typescript
return (
  <div>
    <h1 className="text-xl font-semibold text-foreground mb-6">Gestión QR</h1>
    <QrManagementClient products={products} />
  </div>
)
```

---

### `src/app/(app)/escanear/page.tsx` (Server Component — new)

**Analog:** `src/app/(app)/dashboard/page.tsx`

**Imports pattern** (lines 1-3, adapted):
```typescript
import dynamic from 'next/dynamic'
import { getAuthenticatedUser } from '@/lib/dal'

const QrScannerClient = dynamic(
  () => import('@/components/qr-scanner-client').then(m => m.QrScannerClient),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground">Cargando cámara...</p> }
)
```

**Auth guard** (same pattern as all Server Component pages):
```typescript
export default async function EscanearPage() {
  await getAuthenticatedUser()  // any authenticated user can scan
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Escanear QR</h1>
      <QrScannerClient />
    </div>
  )
}
```

**Critical constraint from RESEARCH.md:** The `dynamic(..., { ssr: false })` wrapper MUST live in the Server Component page file, not in the Client Component itself. This prevents qr-scanner's Worker from being evaluated during SSR.

---

### `src/app/(app)/reducir/[productId]/page.tsx` (Server Component — new)

**Analog:** `src/app/(app)/productos/[id]/page.tsx`

**Imports pattern** (`src/app/(app)/productos/[id]/page.tsx` lines 1-24):
```typescript
import { notFound } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { subtractStockViaQR } from './actions'
```

**Dynamic params pattern** (`src/app/(app)/productos/[id]/page.tsx` lines 32-44):
```typescript
export default async function ReducirPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  await getAuthenticatedUser()

  // MUST await — params is a Promise in Next.js 16 (RESEARCH.md Pitfall 5)
  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, nombre: true, stock: true, unidad: true },
  })

  if (!product) {
    notFound()
  }
  // ...
}
```

**Two-step client state pattern** — this page renders a Client Component that manages step state. See `src/components/stock-movement-dialog.tsx` lines 46-101 for the `step`, `values`, `useState` pattern. The /reducir page is a full page (not a dialog), but copies the same Step 1 / Step 2 logic using `useState<1 | 2>`.

**Bound action pattern** (`src/app/(app)/productos/[id]/page.tsx` line 86):
```typescript
const boundAction = subtractStockViaQR.bind(null, product.id)
```
Pass `boundAction` as a prop to the Client Component that contains the form with `useActionState`.

---

### `src/app/(app)/reducir/[productId]/actions.ts` (Server Action — new)

**Analog:** `src/app/(app)/productos/[id]/actions.ts` — **direct structural copy with two changes: delta is forced negative; motivo is hardcoded to 'Escaneo QR'.**

**Full file pattern** (`src/app/(app)/productos/[id]/actions.ts` lines 1-84):

```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/dal'

// Schema validates productId as UUID + cantidad as positive integer
const ReduceSchema = z.object({
  productId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
})

type ActionState = { error?: string; errors?: Record<string, string[]>; success?: boolean } | undefined

export async function subtractStockViaQR(
  productId: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getAuthenticatedUser()  // T-02: auth always first line

  const validated = ReduceSchema.safeParse({
    productId,
    cantidad: formData.get('cantidad'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { cantidad } = validated.data
  const delta = -cantidad  // forced negative — QR scan is always a reduction

  try {
    await prisma.$transaction(async (tx) => {
      // CRITICAL: { increment: delta } = atomic SQL UPDATE — never read-then-write (CLAUDE.md)
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
        select: { stock: true },
      })

      if (updated.stock < 0) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      // Append-only ledger — never UPDATE or DELETE movement rows (CLAUDE.md)
      await tx.movement.create({
        data: { productId, userId: session.userId, delta, motivo: 'Escaneo QR' },
      })
    })

    revalidatePath('/dashboard')
    revalidatePath(`/productos/${productId}`)
    revalidatePath('/historial')
    return { success: true }

  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
      return { error: 'Stock insuficiente para aplicar la reducción.' }
    }
    return { error: 'Ocurrió un error. Intentá de nuevo.' }
  }
}
```

**Key difference from `addStockMovement`:** The `return undefined` success path is replaced with `return { success: true }` so the page Client Component can detect success and show confirmation UI without relying on `state === undefined`.

---

### `src/app/api/qr/[productId]/route.ts` (Route Handler — new, no codebase analog)

**No analog exists** — this is the first Route Handler in the codebase. Use the RESEARCH.md Pattern 1 verbatim.

**Full pattern** (RESEARCH.md lines 176-217):
```typescript
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  // Call BEFORE any try/catch — redirect() throws internally (RESEARCH.md Pitfall 2)
  await requireAdmin()

  const { productId } = await params  // params is Promise in Next.js 16 (RESEARCH.md Pitfall 5)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) return notFound()

  // QR content: ONLY the immutable UUID — never name/slug (CLAUDE.md constraint)
  const dataUrl = await QRCode.toDataURL(product.id, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  })

  // toDataURL() is the correct API — toBuffer() does not exist (RESEARCH.md Pitfall 4)
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(b64, 'base64')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${product.id}.png"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
```

**Critical:** `requireAdmin()` is called at the top, outside any try/catch. The `redirect()` it throws internally must not be caught.

---

### `src/components/qr-management-client.tsx` (Client Component — new)

**Analog:** `src/components/dashboard-client.tsx`

**Directive + imports pattern** (`src/components/dashboard-client.tsx` lines 1-18):
```typescript
'use client'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

**Props type pattern** (`src/components/dashboard-client.tsx` lines 19-36):
```typescript
type Product = { id: string; nombre: string }

type QrManagementClientProps = {
  products: Product[]
}

export function QrManagementClient({ products }: QrManagementClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // ...
}
```

**Selection state pattern** — use `useState<Set<string>>` for checkbox selection, mirroring the filter state approach in `dashboard-client.tsx` lines 38-47.

**Download link pattern** (no codebase analog — use HTML anchor):
```typescript
// "Descargar QR" = plain anchor pointing to Route Handler
<a href={`/api/qr/${product.id}`} download>
  <Button variant="outline" size="sm">Descargar PNG</Button>
</a>
```

**Print trigger pattern** (RESEARCH.md Pattern 4):
```typescript
// "Imprimir seleccionados" button
<Button onClick={() => window.print()}>Imprimir seleccionados</Button>

// Screen: hide print grid
<div className="print:hidden">
  {/* checkboxes, controls */}
</div>

// Print: show only QR grid (hidden on screen)
<div className="hidden print:block" id="print-target">
  {/* 4-col grid of selected products' QR images */}
  <div className="grid grid-cols-4 gap-4">
    {selectedProducts.map(p => (
      <div key={p.id} className="flex flex-col items-center gap-1">
        <img src={`/api/qr/${p.id}`} alt={p.nombre} className="w-full" />
        <span className="text-xs text-center">{p.nombre}</span>
      </div>
    ))}
  </div>
</div>
```

**shadcn Checkbox note** (RESEARCH.md Pitfall 8): The base-nova preset `Checkbox` does not support `checked="indeterminate"`. Use a native `<input type="checkbox">` for the "select all" toggle, or manage visual state manually (checked if all selected, unchecked otherwise).

---

### `src/components/qr-scanner-client.tsx` (Client Component — new)

**Analog:** `src/components/stock-movement-dialog.tsx` (partial — shares useRef, useEffect, useActionState lifecycle patterns)

**Directive + imports pattern** (`src/components/stock-movement-dialog.tsx` lines 1-8, adapted):
```typescript
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
```

**useRef + useEffect lifecycle pattern** (`src/components/stock-movement-dialog.tsx` lines 63-78, adapted for scanner):
```typescript
export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<import('qr-scanner').default | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!videoRef.current) return

    // Dynamic import inside useEffect — qr-scanner uses browser APIs + Web Worker
    // This is the second SSR safety layer (first is ssr:false in page.tsx)
    import('qr-scanner').then(({ default: QrScanner }) => {
      const scanner = new QrScanner(
        videoRef.current!,
        (result) => {
          const uuid = result.data
          // Guard: only navigate for valid UUID format
          if (/^[0-9a-f-]{36}$/.test(uuid)) {
            scanner.stop()
            router.push(`/reducir/${uuid}`)
          }
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          onDecodeError: (err) => {
            // Fires every frame when no QR found — ignore it (RESEARCH.md Pitfall 3)
            if (err === QrScanner.NO_QR_CODE_FOUND) return
            console.error('QR decode error:', err)
          },
        }
      )
      scannerRef.current = scanner
      scanner.start().catch((err) => console.error('Camera start failed:', err))
    })

    // Cleanup: destroy stops stream + worker — required to prevent battery drain (RESEARCH.md Pitfall 1)
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [router])

  return <video ref={videoRef} style={{ width: '100%' }} />
}
```

**HTTPS error state**: Add a `useEffect` that checks `location.protocol !== 'https:' && location.hostname !== 'localhost'` and renders an error message instead of starting the scanner. (RESEARCH.md Pitfall 6)

---

### `src/app/(app)/reducir/[productId]/not-found.tsx` (error boundary — new)

**Analog:** `notFound()` call in `src/app/(app)/productos/[id]/page.tsx` line 82 defines when this fires; the file itself has no codebase analog.

**Pattern** (standard Next.js not-found boundary, matches project's existing empty-state UI style from `src/app/(app)/historial/page.tsx` lines 151-170):
```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ReducirNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-base font-semibold text-foreground mb-1">
        Producto no encontrado
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        El código QR no corresponde a ningún producto activo.
      </p>
      <Button variant="ghost" render={<Link href="/escanear" />}>
        Volver a escanear
      </Button>
    </div>
  )
}
```

Note the `render={<Link href="..." />}` prop on `Button` — this is the shadcn base-nova pattern used consistently throughout the codebase (see `src/app/(app)/historial/page.tsx` line 167).

---

### `src/components/app-sidebar.tsx` (modify — add /escanear nav item)

**Self-analog** — read the full file above.

**Nav items array** (lines 18-24 — add one entry):
```typescript
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/qr', label: 'Gestión QR', icon: QrCode },
  { href: '/escanear', label: 'Escanear QR', icon: ScanLine },  // ADD
  { href: '/alertas', label: 'Config. Alertas', icon: Bell },
]
```

Add `ScanLine` to the lucide-react import on line 2. `ScanLine` is the correct icon name (verified: lucide-react exports `ScanLine`).

**Role-based visibility**: `AppSidebar` is an async Server Component (line 26) and calls `getAuthenticatedUser()` (line 27). The session `role` is available. Optionally filter navItems based on role — `/qr` for ADMIN only, `/escanear` for all. This is a Claude's Discretion decision for the planner to finalize.

---

### `src/components/bottom-nav.tsx` (modify — add /escanear nav item)

**Self-analog** — read the full file above.

**Nav items array** (lines 7-13 — add one entry):
```typescript
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/qr', label: 'QR', icon: QrCode },
  { href: '/escanear', label: 'Escanear', icon: ScanLine },  // ADD
  { href: '/alertas', label: 'Alertas', icon: Bell },
]
```

Add `ScanLine` to the lucide-react import on line 4. Note: `BottomNav` is `'use client'` with no access to session — it cannot filter by role. If role-based visibility is required, the planner must decide whether to: (a) pass `role` as a prop from `src/app/(app)/layout.tsx` (which is a Server Component), or (b) show all items to all roles and rely on the page's own auth guard.

---

## Shared Patterns

### Authentication — `getAuthenticatedUser()` vs `requireAdmin()`

**Source:** `src/lib/dal.ts` (lines 13-32)

```typescript
// Any authenticated user (ADMIN or OPERADOR):
const session = await getAuthenticatedUser()
// session.userId, session.role, session.username available

// ADMIN only — redirects to /dashboard if OPERADOR:
await requireAdmin()
```

**Apply to:**
- `src/app/(app)/qr/page.tsx` → `requireAdmin()`
- `src/app/(app)/escanear/page.tsx` → `getAuthenticatedUser()`
- `src/app/(app)/reducir/[productId]/page.tsx` → `getAuthenticatedUser()`
- `src/app/(app)/reducir/[productId]/actions.ts` → `getAuthenticatedUser()` (always first line)
- `src/app/api/qr/[productId]/route.ts` → `requireAdmin()` (before any try/catch)

### Atomic Stock Mutation Pattern

**Source:** `src/app/(app)/productos/[id]/actions.ts` (lines 42-69)

```typescript
await prisma.$transaction(async (tx) => {
  const updated = await tx.product.update({
    where: { id: productId },
    data: { stock: { increment: delta } },  // delta is negative for QR reductions
    select: { stock: true },
  })
  if (updated.stock < 0) throw new Error('INSUFFICIENT_STOCK')
  await tx.movement.create({
    data: { productId, userId: session.userId, delta, motivo: 'Escaneo QR' },
  })
})
```

**Apply to:** `src/app/(app)/reducir/[productId]/actions.ts` only.

### Error Handling in Server Actions

**Source:** `src/app/(app)/productos/[id]/actions.ts` (lines 78-83)

```typescript
} catch (err) {
  if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
    return { error: 'Stock insuficiente para aplicar la reducción.' }
  }
  return { error: 'Ocurrió un error. Intentá de nuevo.' }
}
```

**Apply to:** `src/app/(app)/reducir/[productId]/actions.ts`

### Toast Notifications

**Source:** `src/components/stock-movement-dialog.tsx` (lines 68-88)

```typescript
import { toast } from 'sonner'

// On success:
toast.success('Stock actualizado')

// On error:
toast.error('Ocurrió un error. Intentá de nuevo.')
```

**Apply to:** `src/components/qr-scanner-client.tsx` (camera error feedback), `src/app/(app)/reducir/[productId]/` Client Component (success/error feedback after form submit).

### useActionState + submittedRef Pattern

**Source:** `src/components/stock-movement-dialog.tsx` (lines 63-97)

```typescript
const [state, formAction, pending] = useActionState(action, undefined)
const submittedRef = useRef(false)

// Success detection:
useEffect(() => {
  if (submittedRef.current && state?.success && !pending) {
    toast.success('Stock reducido')
    submittedRef.current = false
  }
}, [state, pending])

// Error detection:
useEffect(() => {
  if (submittedRef.current && state?.error && !pending) {
    toast.error(state.error)
  }
}, [state, pending])
```

Note: `subtractStockViaQR` returns `{ success: true }` on success (not `undefined`) so the Client Component can detect success without the `state === undefined` check used in `StockMovementDialog`.

**Apply to:** The Client Component inside `src/app/(app)/reducir/[productId]/page.tsx` (or a sibling `reducir-client.tsx`).

### Prisma Singleton Import

**Source:** `src/lib/prisma.ts` (line 12)

```typescript
import { prisma } from '@/lib/prisma'
```

**Apply to:** All files that query the database: `src/app/(app)/qr/page.tsx`, `src/app/(app)/reducir/[productId]/page.tsx`, `src/app/api/qr/[productId]/route.ts`, `src/app/(app)/reducir/[productId]/actions.ts`.

### revalidatePath After Mutation

**Source:** `src/app/(app)/productos/[id]/actions.ts` (lines 73-76)

```typescript
revalidatePath('/dashboard')
revalidatePath(`/productos/${productId}`)
revalidatePath('/historial')
```

**Apply to:** `src/app/(app)/reducir/[productId]/actions.ts` — same three paths.

### Await Params in Dynamic Routes

**Source:** `src/app/(app)/productos/[id]/page.tsx` (lines 32-44)

```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params  // MUST await — Next.js 16 (RESEARCH.md Pitfall 5)
```

**Apply to:** `src/app/(app)/reducir/[productId]/page.tsx`, `src/app/api/qr/[productId]/route.ts`.

### Empty State / No Results UI

**Source:** `src/app/(app)/historial/page.tsx` (lines 151-170)

```typescript
<div className="flex flex-col items-center justify-center py-16 text-center">
  <h2 className="text-base font-semibold text-foreground mb-1">Sin resultados</h2>
  <p className="text-sm text-muted-foreground mb-4">...</p>
  <Button variant="ghost" render={<Link href="..." />}>
    Acción
  </Button>
</div>
```

**Apply to:** `src/app/(app)/reducir/[productId]/not-found.tsx`, and empty-product state in `src/components/qr-management-client.tsx`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/api/qr/[productId]/route.ts` | route handler | request-response (binary I/O) | No Route Handlers exist in the codebase yet. Use RESEARCH.md Pattern 1 verbatim. |

---

## Metadata

**Analog search scope:** `src/app/(app)/`, `src/app/api/`, `src/components/`, `src/lib/`
**Files scanned:** 14 source files read; 0 existing Route Handlers found
**Pattern extraction date:** 2026-05-03
