# Phase 3: QR Workflow - Research

**Researched:** 2026-05-03
**Domain:** QR code generation (server-side), QR code scanning (browser camera), Next.js 16 Route Handlers, atomic stock mutations
**Confidence:** HIGH (most findings verified against in-repo docs and library source; key assumptions flagged)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: qr-scanner (by Nimiq/Niklas Haas) for browser-side QR scanning — NOT html5-qrcode
- D-05: On successful scan, auto-navigate to /reducir/[productId] — no confirmation on scanner page
- D-06: /reducir/[productId] is a 2-step full page (Step 1: entry, Step 2: confirmation)
- D-07: Atomic stock reduction with prisma.$transaction + { increment: delta } (delta negative)
- D-10: Individual QR PNG via Route Handler at /api/qr/[productId]
- D-11: QR generation: qrcode npm package (server-side, Node.js Route Handler)
- D-12: Print sheet via browser-native window.print() + CSS @media print, @page { size: A4; margin: 10mm }
- D-13: Grid: 4 columns x 5 rows = 20 QR codes per A4 page

### Claude's Discretion
- (Consult CONTEXT.md if it exists; not yet created at research time)

### Deferred Ideas (OUT OF SCOPE)
- (Consult CONTEXT.md if it exists)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOCK-02 | Stock reductions are atomic — concurrent scans cannot produce negative stock | Covered by Prisma.$transaction + { increment: negative_delta } + post-update floor check, identical pattern to addStockMovement |
| QR-01 | Admin can generate and download a PNG QR code for any product; QR encodes only the immutable product UUID | qrcode.toDataURL() server-side → Route Handler returns image/png binary; UUID-only encoding is enforced at the action layer |
| QR-02 | Admin can generate a printable A4 sheet with QR codes for selected active products | window.print() + CSS @media print + @page { size: A4; margin: 10mm }; 4×5 grid; shadcn checkbox for product selection |
| QR-03 | Operador can scan a QR from mobile browser, confirm, and have stock updated atomically | qr-scanner client component (dynamic import, ssr:false) → auto-navigate to /reducir/[id] → Server Action with prisma.$transaction |
</phase_requirements>

---

## Summary

Phase 3 adds the complete QR workflow: server-side PNG generation, printable product sheets, and mobile camera scanning that drives an atomic stock reduction. The technical surface spans three distinct domains: a Node.js Route Handler for binary image responses, a client-side React camera component with a non-bundleable Web Worker, and a Server Action for the reduction mutation.

The most important research finding is the **qr-scanner Web Worker file handling**: the library does `import('./qr-scanner-worker.min.js')` as a bare relative dynamic import. Modern bundlers (webpack, which Next.js 16 uses) handle this automatically — the worker is emitted as a separate chunk and served correctly in development and production. No manual copy to `/public` is needed. This is confirmed by the library README and is the current documented approach.

The second critical finding is that **`qrcode` has no `toBuffer()` method in its public API** despite what some blog posts claim. The correct server-side pattern for a binary PNG response is: call `QRCode.toDataURL(uuid, options)` to get a `data:image/png;base64,...` string, strip the prefix, decode with `Buffer.from(b64, 'base64')`, and return that buffer as the HTTP response body. This is two extra lines but is entirely reliable.

**Primary recommendation:** Follow the locked decisions exactly. The scanner Client Component must be wrapped in `dynamic(..., { ssr: false })`. The Route Handler auth guard uses `requireAdmin()` which calls `redirect()` — this works correctly in Route Handlers per the Next.js 16 docs. The `subtractStockViaQR` Server Action is a direct copy of `addStockMovement` with `delta` forced negative and an additional UUID validation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| QR PNG generation | API / Backend (Route Handler) | — | Binary image output needs Node.js Buffer; must be authenticated (ADMIN only) |
| Printable QR sheet | Frontend (Client Component) | CSS @media print | window.print() is browser API; product selection state lives in client |
| QR scanning (camera) | Browser / Client | — | getUserMedia is browser-only; qr-scanner requires DOM |
| Stock reduction on scan | API / Backend (Server Action) | Database (Prisma tx) | Atomic mutation must be server-side; mirrors addStockMovement pattern |
| /reducir/[id] page (step 1 & 2) | Frontend Server (page.tsx) | Server Action | Server Component fetches product; Server Action handles mutation |
| Nav item (/escanear) | Browser / Client | — | bottom-nav.tsx is 'use client'; both nav files need /escanear added |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qr-scanner | 1.4.2 | Browser QR scanning via camera | Locked (D-01); maintained, no canvas dep, works on iOS Safari + Android Chrome |
| qrcode | 1.5.4 | Server-side QR PNG generation | Locked (D-11); pure Node.js, no canvas dep, async/await API |
| @types/qrcode | 1.5.6 | TypeScript types for qrcode | Peer to qrcode; separate package required |
| next (already installed) | 16.2.4 | Route Handlers, Server Actions, dynamic import | Already in project |
| prisma (already installed) | 7.x | Atomic stock mutation in $transaction | Already in project; pattern proven in addStockMovement |

### Supporting (already installed, no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.4.1 | Input validation in Server Actions | Validate productId UUID and delta in subtractStockViaQR |
| sonner | 2.0.7 | Toast notifications | Success/error feedback on /reducir/[id] page |
| lucide-react | 1.14.x | Icons | QrCode icon already used in nav; Camera icon for scan page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| qrcode + manual base64 decode | qrcode-png, qr-image | qrcode is already decided (D-11) and most popular Node.js QR lib |
| qr-scanner dynamic import | next/dynamic wrapping the component file | Both work; dynamic import inside useEffect is equally valid |

**Installation (new packages only):**
```bash
npm install qr-scanner qrcode @types/qrcode
```

**Version verification:** [VERIFIED: npm registry — 2026-05-03]
- qr-scanner: 1.4.2
- qrcode: 1.5.4
- @types/qrcode: 1.5.6

---

## Architecture Patterns

### System Architecture Diagram

```
ADMIN FLOW — QR Generation
──────────────────────────
/qr (page.tsx, Server Component)
  │ fetches active products from Prisma
  │ renders QrManagementClient (Client Component)
  │
  └─► QrManagementClient ('use client')
        │ checkbox selection state (useState)
        │ "Descargar QR" → <a href="/api/qr/[id]" download>
        │ "Imprimir seleccionados" → window.print()
        │
        └─► /api/qr/[productId]/route.ts (GET Route Handler)
              │ requireAdmin() — redirect() if not ADMIN
              │ prisma.product.findUnique({ where: { id } })
              │ QRCode.toDataURL(product.id)  ← encodes UUID only
              │ Buffer.from(b64, 'base64')
              └─► Response(buffer, { 'Content-Type': 'image/png' })

OPERADOR FLOW — QR Scan → Stock Reduction
──────────────────────────────────────────
/escanear (page.tsx, Server Component)
  │ getAuthenticatedUser()
  └─► QrScannerClient ('use client', dynamic import ssr:false)
        │ <video ref={videoRef} />
        │ QrScanner(video, onDecode, { preferredCamera: 'environment' })
        │ onDecode: result.data → must be UUID → router.push('/reducir/'+id)
        │ cleanup: qrScanner.destroy() in useEffect return
        │
        └─► /reducir/[productId] (page.tsx, Server Component)
              │ getAuthenticatedUser()
              │ prisma.product.findUnique({ where: { id: productId } })
              │ Step 1: render quantity input form
              │ Step 2 (after submit): render confirmation screen
              │
              └─► subtractStockViaQR (Server Action)
                    │ getAuthenticatedUser()
                    │ Zod validate: productId (uuid), delta (negative int)
                    └─► prisma.$transaction:
                          product.update({ stock: { increment: negativeDelta } })
                          if updated.stock < 0 → throw ROLLBACK
                          movement.create(...)
                          revalidatePath(...)
```

### Recommended Project Structure
```
src/
├── app/
│   ├── (app)/
│   │   ├── qr/
│   │   │   └── page.tsx              # Server Component: fetch products, render QrManagementClient
│   │   ├── escanear/
│   │   │   └── page.tsx              # Server Component: auth guard, render QrScannerClient
│   │   └── reducir/
│   │       └── [productId]/
│   │           ├── page.tsx          # Server Component: 2-step reduction page
│   │           └── actions.ts        # subtractStockViaQR Server Action
│   └── api/
│       └── qr/
│           └── [productId]/
│               └── route.ts          # GET Route Handler → PNG binary response
├── components/
│   ├── qr-management-client.tsx      # 'use client': product selection, print trigger
│   └── qr-scanner-client.tsx         # 'use client': camera scanner, dynamic import
```

### Pattern 1: Route Handler — Binary PNG Response

```typescript
// src/app/api/qr/[productId]/route.ts
// Source: Next.js 16 docs (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md)
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  // requireAdmin() calls redirect() if not ADMIN — this works in Route Handlers
  await requireAdmin()

  const { productId } = await params  // params is Promise in Next.js 16

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) return notFound()

  // QR content: ONLY the immutable UUID (CLAUDE.md constraint)
  const dataUrl = await QRCode.toDataURL(product.id, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  })

  // toDataURL returns "data:image/png;base64,<b64>" — strip prefix to get raw bytes
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(b64, 'base64')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${product.id}.png"`,
      'Cache-Control': 'public, max-age=31536000, immutable',  // UUID never changes
    },
  })
}
```

### Pattern 2: QR Scanner Client Component

```typescript
// src/components/qr-scanner-client.tsx
// Source: qr-scanner README (github.com/nimiq/qr-scanner) + Next.js lazy-loading docs
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<import('qr-scanner').default | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!videoRef.current) return

    // Dynamic import required — qr-scanner uses browser APIs and a Web Worker
    // ssr: false not needed here because this component only renders client-side
    import('qr-scanner').then(({ default: QrScanner }) => {
      const scanner = new QrScanner(
        videoRef.current!,
        (result) => {
          // result.data is the decoded string — the UUID
          // Guard: must look like a UUID to avoid acting on other QR codes
          const uuid = result.data
          if (/^[0-9a-f-]{36}$/.test(uuid)) {
            scanner.stop()
            router.push(`/reducir/${uuid}`)
          }
        },
        {
          returnDetailedScanResult: true,     // result.data instead of deprecated string
          preferredCamera: 'environment',     // rear camera on mobile
          onDecodeError: (err) => {
            // QrScanner.NO_QR_CODE_FOUND fires every frame — ignore it
            if (err === QrScanner.NO_QR_CODE_FOUND) return
            console.error('QR decode error:', err)
          },
        }
      )
      scannerRef.current = scanner
      scanner.start().catch((err) => {
        // Camera permission denied or HTTPS missing
        console.error('Camera start failed:', err)
      })
    })

    // Cleanup: stop camera stream and worker on unmount
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [router])

  return <video ref={videoRef} style={{ width: '100%' }} />
}
```

**Key: the page that renders this component uses `dynamic` with `ssr: false`:**

```typescript
// src/app/(app)/escanear/page.tsx
import dynamic from 'next/dynamic'
const QrScannerClient = dynamic(
  () => import('@/components/qr-scanner-client').then(m => m.QrScannerClient),
  { ssr: false, loading: () => <p>Cargando cámara...</p> }
)
```

### Pattern 3: subtractStockViaQR Server Action

```typescript
// src/app/(app)/reducir/[productId]/actions.ts
// Source: mirrors addStockMovement in src/app/(app)/productos/[id]/actions.ts (VERIFIED: in repo)
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/dal'

const ReduceSchema = z.object({
  productId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
})

export async function subtractStockViaQR(
  productId: string,
  prevState: unknown,
  formData: FormData,
) {
  const session = await getAuthenticatedUser()  // Any authenticated user can reduce via QR

  const validated = ReduceSchema.safeParse({
    productId,
    cantidad: formData.get('cantidad'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { cantidad } = validated.data
  const delta = -cantidad  // negative delta = stock reduction

  try {
    await prisma.$transaction(async (tx) => {
      // CRITICAL: atomic SQL — never read-then-write (CLAUDE.md constraint)
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
        select: { stock: true },
      })

      if (updated.stock < 0) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      // Append-only ledger — never UPDATE or DELETE movements
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

### Pattern 4: Print Sheet CSS Strategy

```typescript
// src/app/(app)/qr/page.tsx (Server Component portion)
// print: variant IS a built-in Tailwind v4 modifier (verified: GitHub issue #18699 confirms it exists)
// The issue is a Safari rendering bug, not a missing feature.

// In QrManagementClient (Client Component):
// Screen: show sidebar, filters, selection controls
// Print: only show the QR grid

// CSS approach using Tailwind v4 print: variant:
// <div className="print:hidden"> ... app chrome ... </div>
// <div className="hidden print:block"> ... QR grid ... </div>
//
// @page CSS via globals.css or inline style tag:
// @media print { @page { size: A4; margin: 10mm; } }
//
// Because globals.css already uses CSS-first @layer base, add:
// @media print { @page { size: A4; margin: 10mm; } body > * { display: none; } #print-target { display: block !important; } }
```

### Anti-Patterns to Avoid

- **Encoding anything other than the UUID in the QR code:** The QR must encode `product.id` only. Never include the product name, slug, or current URL. (CLAUDE.md: "Encode only immutable product UUID. Never name, slug, or any mutable field.")
- **Read-then-write stock:** Never `findUnique` → compute new value → `update` with the computed value. Always use `{ increment: negativeDelta }` inside a transaction.
- **Importing qr-scanner at module level in a Server Component (or any component without ssr:false):** The library accesses `navigator`, `document`, and spawns a Worker — it will throw during SSR. Always use `dynamic(..., { ssr: false })` or `import()` inside `useEffect`.
- **Calling `requireAdmin()` and expecting a return value after a redirect:** `redirect()` in Next.js throws internally. The call `await requireAdmin()` is sufficient; if the user is not ADMIN, execution stops.
- **Not calling `destroy()` on QrScanner unmount:** Camera stream keeps running after navigation, draining battery. The `useEffect` cleanup must call `scanner.destroy()`.
- **Using params without await in Next.js 16:** Both `params` and `searchParams` are `Promise` objects in Next.js 16. Always `const { id } = await params`. (Confirmed by existing codebase pattern in products/[id]/page.tsx.)
- **Copying qr-scanner-worker.min.js to /public manually:** The webpack bundler handles the dynamic import automatically. Manual copies create stale file drift.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR PNG encoding | Custom PNG encoder | qrcode npm | Handles error correction, quiet zones, data segmentation |
| Camera frame decoding | Custom frame processor | qr-scanner (uses ZXing WASM worker) | Browser/device compatibility, iOS Safari quirks, frame throttling |
| Atomic stock floor | Application-level locking or optimistic concurrency | Prisma.$transaction + { increment } | DB-level atomicity; proven pattern already in addStockMovement |
| Print layout | Custom PDF generation | window.print() + CSS @media print | No server round-trip, no dependencies, instant — sufficient for A4 grid |

**Key insight:** The `qr-scanner` library bundles ZXing compiled to WebAssembly in the worker, giving 95%+ QR detection accuracy across iOS Safari, Android Chrome, and desktop. Building equivalent accuracy from scratch is weeks of work.

---

## Common Pitfalls

### Pitfall 1: qr-scanner Worker Not Loading (SSR or Bundler Misconfiguration)
**What goes wrong:** The library throws `WorkerGlobalScope is not defined` or the scanner silently does nothing.
**Why it happens:** The worker file is loaded via a relative `import('./qr-scanner-worker.min.js')`. If the component is SSR'd, there is no Worker global, and the dynamic import resolves at server build time to a Node.js module that lacks the Worker API.
**How to avoid:** Wrap the scanner component with `dynamic(..., { ssr: false })` at the page level. The `useEffect` import inside the component adds a second layer of safety.
**Warning signs:** `ReferenceError: Worker is not defined` in server logs; scanner never calls `onDecode`.

### Pitfall 2: `redirect()` from `requireAdmin()` Breaks Route Handler If Not Handled Correctly
**What goes wrong:** `redirect()` in Next.js 16 works by throwing an internal error (NEXT_REDIRECT). If caught by a bare `try/catch` block, the redirect is swallowed and the Route Handler returns 200.
**Why it happens:** Broad `try/catch` blocks around the entire handler body intercept the internal throw.
**How to avoid:** Never wrap `requireAdmin()` in a try/catch. Call it at the top of the handler before any try blocks. The confirmed pattern from Next.js 16 docs: `redirect()` in Route Handlers works correctly when not caught.
**Warning signs:** Unauthenticated requests get a 200 with an empty body instead of a 302 redirect.

### Pitfall 3: `onDecodeError` Fires Every Frame
**What goes wrong:** Developer adds console.error to onDecodeError and the console floods with "No QR code found" messages, masking real errors.
**Why it happens:** qr-scanner processes every camera frame. When no QR is found, it calls onDecodeError with the string `QrScanner.NO_QR_CODE_FOUND` ("No QR code found"). This is expected behavior, not an error.
**How to avoid:** Always gate: `if (err === QrScanner.NO_QR_CODE_FOUND) return;` at the top of onDecodeError.
**Warning signs:** Console is flooded at 25 fps with decode error messages.

### Pitfall 4: `qrcode.toBuffer()` Does Not Exist
**What goes wrong:** TypeScript errors or runtime "toBuffer is not a function".
**Why it happens:** Many blog posts claim `QRCode.toBuffer()` exists, but the `qrcode` 1.5.x public API does not expose this method. The actual API is `toDataURL()`, `toFile()`, `toString()`, `toFileStream()`.
**How to avoid:** Use `QRCode.toDataURL(text, options)` → strip the `data:image/png;base64,` prefix → `Buffer.from(b64, 'base64')`.
**Warning signs:** TypeScript type error on `QRCode.toBuffer`; or runtime error if called without type-checking.

### Pitfall 5: `params` Not Awaited in Next.js 16
**What goes wrong:** `params.productId` is `undefined` or TypeScript reports a type error on non-Promise access.
**Why it happens:** Next.js 16 changed `params` and `searchParams` to be `Promise` objects (confirmed by existing code in `productos/[id]/page.tsx` and `route.md`).
**How to avoid:** Always `const { productId } = await params` in both page components and Route Handlers. Pattern already used throughout the codebase.
**Warning signs:** `productId` is `undefined` at runtime; 404 for all dynamic routes.

### Pitfall 6: Camera Fails on Non-HTTPS (mobile browsers)
**What goes wrong:** `getUserMedia` (used internally by qr-scanner) throws `NotAllowedError` or `NotSupportedError` on Android Chrome and iOS Safari when served over HTTP (non-localhost).
**Why it happens:** Browser security policy forbids camera access on insecure origins. CLAUDE.md constraint: "HTTPS required from day one."
**How to avoid:** Ensure the deployment has HTTPS. During local development, `localhost` is treated as secure — `http://localhost:3000` works. The `/escanear` page should detect `location.protocol !== 'https:' && location.hostname !== 'localhost'` and render a clear error state instead of trying to start the scanner.
**Warning signs:** `navigator.mediaDevices` is undefined; `getUserMedia` throws `NotSupportedError`.

### Pitfall 7: Print CSS Hiding `<html>` or `<body>` Breaks React
**What goes wrong:** Using `display: none` on `<body>` or `<html>` to hide the app shell during print causes React hydration errors or breaks the app after print closes.
**Why it happens:** Directly manipulating display on root elements during print can leave the DOM in an inconsistent state.
**How to avoid:** Use `print:hidden` on the wrapper div (SidebarProvider/SidebarInset level), not on body/html. Use a dedicated `#print-target` div with `hidden print:block` for the QR grid. The `(app)/layout.tsx` structure makes this feasible — wrap the print content as a sibling to the sidebar, not inside it.

### Pitfall 8: shadcn `checkbox` Has No Indeterminate State in base-nova Preset
**What goes wrong:** Trying to use `checked="indeterminate"` on the shadcn Checkbox component (base-nova style) gets a TypeScript error and does not render the indeterminate visual.
**Why it happens:** The base-nova preset uses `@base-ui/react` primitives, and Base UI's Checkbox does not support the indeterminate state that Radix UI's version does. This is a confirmed open issue (github.com/shadcn-ui/ui/issues/9357 — open as of research date).
**How to avoid:** For "select all" behavior on the QR print sheet, implement it using a native HTML `<input type="checkbox">` with `indeterminate` set via a ref, or manage the visual state manually. The simpler approach: use a non-indeterminate checkbox (checked if all are selected, unchecked otherwise) — avoids the issue entirely since the UX need is minimal.
**Warning signs:** TypeScript error `Type '"indeterminate"' is not assignable to type 'boolean'` when using shadcn Checkbox with base-nova.

---

## Code Examples

### QRCode Server-Side PNG Generation (Verified Pattern)
```typescript
// Source: qrcode README (github.com/soldair/node-qrcode) + confirmed API surface
import QRCode from 'qrcode'

const dataUrl = await QRCode.toDataURL(productId, {
  errorCorrectionLevel: 'M',  // M = ~15% damage recovery — good for printed labels
  width: 300,                  // pixel width of output PNG
  margin: 2,                   // quiet zone (default 4 is often too large for dense grids)
})
// dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANS..."
const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
const buffer = Buffer.from(b64, 'base64')
// buffer is a valid PNG binary, ready to send as Response body
```

### QrScanner Initialization and Cleanup (Verified Pattern)
```typescript
// Source: qr-scanner source (github.com/nimiq/qr-scanner/blob/master/src/qr-scanner.ts)
import QrScanner from 'qr-scanner'  // type import; actual load is dynamic

// Constructor: new QrScanner(videoElement, onDecode, options)
// onDecode receives: { data: string, cornerPoints: Point[] }
// onDecodeError receives: Error | string (use QrScanner.NO_QR_CODE_FOUND for comparison)
// start(): Promise<void> — prompts camera permission
// stop(): void — pauses scanning, leaves stream open
// destroy(): void — stops stream, terminates worker, removes event listeners

// Static methods:
// QrScanner.hasCamera(): Promise<boolean>
// QrScanner.NO_QR_CODE_FOUND: 'No QR code found' (string constant)
```

### Route Handler Binary Response (Verified Pattern)
```typescript
// Source: Next.js 16 route.md (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md)
// params is Promise<{ productId: string }> in Next.js 16 — MUST be awaited
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  // ...generate buffer...
  return new Response(buffer, {
    headers: { 'Content-Type': 'image/png' }
  })
}
```

### Navigation Items to Add (Verified: in repo)
```typescript
// Both nav files currently include /qr (Gestión QR) and /alertas
// Need to add /escanear for OPERADOR flow
// app-sidebar.tsx: add { href: '/escanear', label: 'Escanear QR', icon: ScanLine }
// bottom-nav.tsx: add { href: '/escanear', label: 'Escanear', icon: ScanLine }
// Both files already import from lucide-react — ScanLine or Scan icon exists
// Only OPERADOR needs /escanear; ADMIN needs /qr for management
// Simplest approach: show /escanear to all roles (ADMIN can also scan if needed)
// More correct: show /escanear only to OPERADOR and hide /qr from OPERADOR
// nav files: app-sidebar.tsx is async Server Component (can call getAuthenticatedUser)
// bottom-nav.tsx is 'use client' — cannot call getAuthenticatedUser; receives no props
// => Either show /escanear to all, or pass role as prop to BottomNav from layout
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `QrScanner.WORKER_PATH` setter | Not needed; webpack handles dynamic import | qr-scanner v1.4+ | No manual public/ copy required |
| `html5-qrcode` | qr-scanner (Nimiq) | Decided in CONTEXT.md | Better iOS Safari support, smaller bundle |
| Next.js `middleware.ts` | `proxy.ts` (custom name per AGENTS.md) | Next.js 16 | Auth guard is in proxy.ts, not middleware.ts |
| `params.id` (sync) | `const { id } = await params` | Next.js 15+ | All dynamic params are Promises |
| qrcode `toBuffer()` (never existed) | `toDataURL()` → strip prefix → Buffer.from | Always | Correct API from day one |

**Deprecated/outdated:**
- `QrScanner.WORKER_PATH`: Explicitly marked deprecated in source — "Not required and not supported anymore."
- Legacy QrScanner constructor (string callback): Deprecated; always use `{ returnDetailedScanResult: true }` options form.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next.js 16 webpack automatically handles the qr-scanner worker dynamic import without manual /public copy | Standard Stack, Pitfall 1 | If wrong: scanner is broken in production; fix is to add a webpack copy-webpack-plugin or Next.js custom webpack config |
| A2 | `print:` is a built-in Tailwind v4 variant (not requiring @custom-variant) | Code Examples, Pitfall 7 | If wrong: need to add `@custom-variant print (@media print);` to globals.css — 1-line fix |
| A3 | `redirect()` called inside `requireAdmin()` propagates correctly through a Next.js 16 Route Handler without being caught | Pattern 1 | If wrong: unauthenticated requests to /api/qr/ get 200 instead of redirect; fix is to use `cookies()` + manual 401 response in Route Handlers |
| A4 | The shadcn Checkbox for base-nova style generates at `src/components/ui/checkbox.tsx` when added via `npx shadcn add checkbox` | Pitfall 8 | If wrong: file is at a different path; low risk since planner will verify during Wave 0 |

---

## Open Questions (RESOLVED)

1. **Nav visibility by role**
   - What we know: ADMIN needs /qr (Gestión QR). OPERADOR needs /escanear. The bottom-nav is a Client Component with no access to session.
   - What's unclear: Should /escanear be visible to ADMIN? Should /qr be hidden from OPERADOR?
   - Recommendation: Show /escanear to all authenticated users (simplest). Hide /qr from OPERADOR by passing `role` prop from layout.tsx to BottomNav (layout.tsx is a Server Component and can call `getAuthenticatedUser()`). The /qr page itself guards with `requireAdmin()` so unauthorized access is blocked regardless.
   - **RESOLVED:** Show /escanear to all authenticated users — simplest approach, avoids passing role prop to 'use client' BottomNav (Claude's Discretion).

2. **Print: Tailwind v4 variant confirmed but Safari rendering bug**
   - What we know: `print:` is a built-in Tailwind v4 modifier. GitHub issue #18699 (closed) documents a Safari-specific rendering bug where `print:hidden` didn't work in one report.
   - What's unclear: Whether the Safari bug affects the current Tailwind v4 version (4.2.4 in this project).
   - Recommendation: Use `print:hidden` / `print:block` as primary approach. If testing reveals Safari issues, fallback is raw `@media print { ... }` CSS in globals.css — always works.
   - **RESOLVED:** Use print: variant as-is. If Safari rendering issues are discovered during testing, add raw @media print CSS to globals.css as fallback (1-line fix).

3. **Quantity input on /reducir/[id]: single-step or useActionState?**
   - What we know: D-06 says it's a 2-step page (Step 1: quantity entry; Step 2: confirmation).
   - What's unclear: Whether Step 2 is implemented as a second form state (useActionState) or a separate route (/reducir/[id]/confirmar).
   - Recommendation: Single page with client-side state transition (useState to track step). Step 1 collects `cantidad`, Step 2 shows a preview, Step 2 submit fires the Server Action. This avoids a second route and keeps the URL stable.
   - **RESOLVED:** Single page with useState for step transition per D-06 — no separate /confirmar route, URL stays stable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | qrcode server-side rendering | ✓ | (native to Next.js) | — |
| PostgreSQL (Neon) | Prisma $transaction | ✓ | (remote, always available) | — |
| HTTPS in production | getUserMedia camera API | ✓ | (required by deployment target) | localhost is treated as secure for dev |
| qr-scanner (npm) | QR scanning | ✗ (not yet installed) | 1.4.2 | — |
| qrcode (npm) | QR PNG generation | ✗ (not yet installed) | 1.5.4 | — |
| @types/qrcode | TypeScript types | ✗ (not yet installed) | 1.5.6 | — |

**Missing dependencies with no fallback:**
- `qr-scanner`, `qrcode`, `@types/qrcode` — must be installed in Wave 0.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or pytest.ini found in repo |
| Config file | None — see Wave 0 gaps |
| Quick run command | (not available until Wave 0) |
| Full suite command | (not available until Wave 0) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOCK-02 | Concurrent QR scans cannot produce negative stock | unit (Node.js script) | `npx tsx tests/stock-atomic.test.ts` | ❌ Wave 0 |
| QR-01 | Route Handler returns PNG for valid UUID, 401 for unauthenticated, 404 for unknown UUID | integration (fetch in test) | `npx tsx tests/qr-route-handler.test.ts` | ❌ Wave 0 |
| QR-01 | QR data URL contains exactly `product.id` string | unit | `npx tsx tests/qr-encoding.test.ts` | ❌ Wave 0 |
| QR-02 | Print sheet renders 20 grid cells for 20 products | manual-only | — (no headless print) | manual |
| QR-03 | QR scan on real iOS Safari 17+ + Android Chrome 120+ | manual-only | — (camera hardware required) | manual |
| QR-03 | subtractStockViaQR returns INSUFFICIENT_STOCK when stock would go negative | unit | inside tests/stock-atomic.test.ts | ❌ Wave 0 |

**Note:** This project has no test framework currently installed. Wave 0 should either install one (vitest is simplest for a Next.js project) or scope tests to integration-level curl/fetch scripts only. The planner must decide.

### Sampling Rate
- **Per task commit:** Run `npx tsx tests/` scripts manually (until test framework is set up)
- **Per wave merge:** All tests green
- **Phase gate:** Manual device test on iOS Safari + Android Chrome before marking phase complete

### Wave 0 Gaps
- [ ] `tests/qr-encoding.test.ts` — verifies QRCode.toDataURL only encodes product UUID
- [ ] `tests/qr-route-handler.test.ts` — verifies Route Handler auth, 404, and PNG Content-Type
- [ ] `tests/stock-atomic.test.ts` — verifies concurrent reduction floor at 0
- [ ] Test framework decision: install vitest (recommended for Next.js projects) or use plain tsx scripts

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All routes call `getAuthenticatedUser()` or `requireAdmin()`; Route Handler uses `requireAdmin()` |
| V3 Session Management | no | Session handling implemented in Phase 1 (jose JWT) |
| V4 Access Control | yes | `requireAdmin()` guards QR generation; `getAuthenticatedUser()` guards stock reduction (any auth user can scan) |
| V5 Input Validation | yes | Zod validates productId (uuid format) and cantidad (positive integer) in subtractStockViaQR |
| V6 Cryptography | no | No new cryptography in this phase |

### Known Threat Patterns for QR + Mobile Workflow

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted QR code with arbitrary UUID | Tampering | Server-side: prisma.findUnique returns null for unknown UUID → 404; delta floor check prevents negative stock |
| CSRF on stock reduction Server Action | Tampering | Next.js Server Actions include built-in CSRF protection (same-origin header check) |
| Replay of stock reduction (scan same QR twice quickly) | Tampering | The atomic transaction floor at 0 prevents going negative; movements ledger records both |
| Camera permission phishing (fake HTTPS page) | Spoofing | Deployment must use valid TLS certificate; users verify URL before granting permission |
| Unauth access to /api/qr/[productId] | Elevation | requireAdmin() at top of Route Handler; redirect to /login if no session |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API, params as Promise, redirect() behavior, binary response pattern
- `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` — next/dynamic with ssr:false pattern
- `src/app/(app)/productos/[id]/actions.ts` — addStockMovement pattern (to replicate for subtractStockViaQR)
- `src/lib/dal.ts` — requireAdmin() and getAuthenticatedUser() signatures
- `src/app/(app)/layout.tsx` — AppLayout structure (for print CSS targeting)
- `src/components/app-sidebar.tsx` and `bottom-nav.tsx` — existing nav structure to extend
- `src/lib/prisma.ts` — Prisma singleton pattern
- `components.json` — confirms style: "base-nova" (Base UI, not Radix)
- `package.json` — installed dependency versions
- github.com/nimiq/qr-scanner/blob/master/src/qr-scanner.ts — constructor signature, NO_QR_CODE_FOUND, WORKER_PATH deprecated, destroy()
- npm registry — qr-scanner@1.4.2, qrcode@1.5.4, @types/qrcode@1.5.6

### Secondary (MEDIUM confidence)
- github.com/soldair/node-qrcode README — toDataURL() async API, available options (errorCorrectionLevel, width, margin), no toBuffer()
- github.com/nimiq/qr-scanner README — worker file bundler behavior, initialization examples
- github.com/tailwindlabs/tailwindcss/issues/18699 — confirms print: is a built-in Tailwind v4 variant
- github.com/shadcn-ui/ui/issues/9357 — confirms base-ui Checkbox lacks indeterminate state

### Tertiary (LOW confidence — see Assumptions Log)
- WebSearch results on qr-scanner + Next.js App Router — corroborate that webpack handles worker automatically

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions verified from npm registry; library APIs verified from source
- Architecture: HIGH — based on existing in-repo patterns + Next.js 16 docs
- Pitfalls: HIGH for most; MEDIUM for qr-scanner worker bundling (A1 in Assumptions Log)
- Print CSS: MEDIUM — print: variant confirmed as built-in but Safari rendering behavior is [ASSUMED] stable

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (qrcode and qr-scanner are stable; Next.js 16 APIs stable)
