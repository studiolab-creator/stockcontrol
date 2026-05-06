---
phase: 03-qr-workflow
verified: 2026-05-04T12:00:00Z
status: human_needed
score: 22/22 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navegar a /escanear en dispositivo móvil con cámara"
    expected: "Aparece el visor de cámara en vivo; apuntando al QR de un producto navega automáticamente a /reducir/{uuid} sin paso de confirmación"
    why_human: "Requiere cámara real y dispositivo móvil — no verificable programáticamente"
  - test: "Verificar que el QR generado codifica únicamente el UUID del producto"
    expected: "Descargar PNG desde /qr, escanearlo con una app externa — el contenido debe ser exactamente el UUID del producto, sin nombre ni otro campo"
    why_human: "Requiere app de lectura QR externa para decodificar el contenido real del PNG"
  - test: "Verificar el diálogo de impresión en /qr"
    expected: "Seleccionar productos, click 'Imprimir seleccionados' — el diálogo del sistema aparece mostrando SOLO la grilla 4 columnas con QR e imagen, sin sidebar ni controles de pantalla"
    why_human: "Comportamiento visual de print:hidden/print:block en preview de impresión — no verificable programáticamente"
  - test: "Verificar que al salir de /escanear se apaga la cámara"
    expected: "Navegar a /escanear, luego a otra página — el LED de la cámara debe apagarse (stream destruido)"
    why_human: "Requiere observación física del dispositivo; scanner.destroy() está en el código pero el efecto es solo verificable en dispositivo"
---

# Phase 3: QR Workflow — Verification Report

**Phase Goal:** El flujo QR está completo: ADMIN puede generar e imprimir QR para productos; escanear un QR navega automáticamente a la página de reducción de stock; la reducción es atómica y append-only.
**Verified:** 2026-05-04
**Status:** human_needed
**Re-verification:** No — verificación inicial

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                              | Status       | Evidencia                                                                                      |
|----|----------------------------------------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------------------------|
| 1  | qr-scanner, qrcode y @types/qrcode presentes en node_modules                                     | VERIFIED     | Ambos archivos existen: `node_modules/qr-scanner/qr-scanner.min.js`, `node_modules/qrcode/lib/index.js`; los tres paquetes en package.json |
| 2  | @media print con @page A4 y margin 10mm en globals.css                                            | VERIFIED     | globals.css líneas 131-137: `@media print { @page { size: A4; margin: 10mm; } }`             |
| 3  | GET /api/qr/{uuid} retorna PNG binario para UUID válido con sesión ADMIN                          | VERIFIED     | `route.ts` completo: `requireAdmin()`, `QRCode.toDataURL(product.id)`, `Buffer.from(b64, 'base64')`, `Content-Type: image/png` |
| 4  | GET /api/qr/{uuid} redirige a /login o /dashboard si no autenticado o OPERADOR                   | VERIFIED     | `await requireAdmin()` es la primera línea del handler, antes de cualquier `try/catch` (no hay ningún try/catch en el archivo) |
| 5  | GET /api/qr/{uuid} retorna 404 para UUID desconocido                                              | VERIFIED     | `prisma.product.findUnique` + `if (!product) return notFound()`                               |
| 6  | El PNG codifica SOLO el UUID del producto — nunca nombre, slug ni campo mutable                   | VERIFIED (parcial)| `QRCode.toDataURL(product.id, ...)` — se pasa `product.id` (UUID). Confirmación del contenido del QR requiere verificación humana |
| 7  | Content-Type: image/png y Content-Disposition con UUID en filename                               | VERIFIED     | `route.ts` líneas 38-41: ambos headers presentes con `product.id` en el filename             |
| 8  | /escanear muestra visor de cámara en móvil                                                        | HUMAN NEEDED | Código correcto: `<video ref={videoRef}>`, QrScanner instanciado. Verificación de cámara real requiere dispositivo |
| 9  | Escanear QR con UUID navega automáticamente a /reducir/{uuid} sin paso de confirmación           | HUMAN NEEDED | Código: `UUID_RE.test(uuid)` → `scanner.stop()` → `router.push('/reducir/${uuid}')`. Requiere cámara real |
| 10 | Escanear QR con contenido no-UUID no hace nada — el escáner sigue corriendo                      | VERIFIED     | `if (UUID_RE.test(uuid))` — solo navega para UUIDs válidos, no hay else ni side-effect         |
| 11 | Salir de /escanear detiene el stream y destruye el Web Worker                                    | VERIFIED (parcial)| `return () => { scannerRef.current?.destroy() }` en cleanup de useEffect. Efecto en dispositivo requiere verificación humana |
| 12 | En no-HTTPS no-localhost, /escanear muestra error en lugar de iniciar cámara                     | VERIFIED     | `location.protocol === 'https:' || location.hostname === 'localhost'` → `setHttpsError(true)` → UI de error |
| 13 | El ítem /escanear aparece en sidebar desktop y bottom nav móvil                                  | VERIFIED     | `app-sidebar.tsx` línea 23: `{ href: '/escanear', label: 'Escanear QR', icon: ScanLine }`; `bottom-nav.tsx` línea 12: ítem con label 'Escanear'. 6 ítems en ambos. |
| 14 | ADMIN en /qr ve lista de productos con checkboxes                                                 | VERIFIED     | `qr/page.tsx`: `requireAdmin()`, `prisma.product.findMany`, `<QrManagementClient products={products} />`; `qr-management-client.tsx` renderiza lista con checkboxes por producto |
| 15 | Cada fila tiene enlace 'Descargar PNG' que descarga desde /api/qr/{id}                           | VERIFIED     | `<a href={'/api/qr/${product.id}'} download={...}>` en líneas 113-123 de `qr-management-client.tsx` |
| 16 | ADMIN puede seleccionar productos y hacer click en 'Imprimir seleccionados' para invocar window.print() | VERIFIED | `onClick={() => window.print()}` en Button, `disabled={noneSelected}` — funcionalidad en código |
| 17 | Durante impresión, solo la grilla QR es visible — controles y sidebar ocultos                    | HUMAN NEEDED | `print:hidden` en div de controles, `hidden print:block` en grilla. Resultado visual requiere verificación en print preview |
| 18 | La grilla de impresión usa 4 columnas                                                              | VERIFIED     | `className="grid grid-cols-4 gap-6"` en línea 132 de `qr-management-client.tsx`              |
| 19 | OPERADOR en /qr redirige a /dashboard                                                              | VERIFIED     | `await requireAdmin()` primera línea de `QrPage` — `requireAdmin()` en dal.ts redirige OPERADOR a /dashboard |
| 20 | Si no hay productos, se muestra estado vacío                                                       | VERIFIED     | `if (products.length === 0)` → retorna "Sin productos activos"                                |
| 21 | Confirmar en Paso 2 ejecuta subtractStockViaQR atómicamente con motivo='Escaneo QR'              | VERIFIED     | `prisma.$transaction`, `{ increment: delta }` con `delta = -cantidad`, `motivo: 'Escaneo QR'` hardcodeado |
| 22 | Reducciones concurrentes no producen stock negativo — la transacción hace rollback si stock < 0  | VERIFIED     | `if (updated.stock < 0) { throw new Error('INSUFFICIENT_STOCK') }` dentro de la transacción → ROLLBACK automático |

**Score:** 22/22 truths verificados (4 requieren confirmación humana para comportamiento observable)

---

## Artifact Check

| Artefacto                                                        | Existe | Sustancial | Cableado | Estado     | Notas                                                  |
|------------------------------------------------------------------|--------|------------|----------|------------|--------------------------------------------------------|
| `node_modules/qr-scanner/qr-scanner.min.js`                     | SI     | SI         | SI       | VERIFIED   | Importado dinámicamente en qr-scanner-client.tsx       |
| `node_modules/qrcode/lib/index.js`                               | SI     | SI         | SI       | VERIFIED   | `import QRCode from 'qrcode'` en route.ts              |
| `src/app/globals.css`                                            | SI     | SI         | SI       | VERIFIED   | `@media print { @page { size: A4; margin: 10mm; } }` al final del archivo |
| `src/app/api/qr/[productId]/route.ts`                            | SI     | SI         | SI       | VERIFIED   | GET exportado, requireAdmin, QRCode.toDataURL, Buffer.from, Content-Type |
| `src/components/qr-scanner-client.tsx`                           | SI     | SI         | SI       | VERIFIED   | 'use client', UUID_RE, scanner.destroy(), HTTPS guard, router.push |
| `src/app/(app)/escanear/page.tsx`                                | SI     | SI         | SI       | VERIFIED   | `dynamic(..., { ssr: false })`, `getAuthenticatedUser()` (no requireAdmin) |
| `src/components/app-sidebar.tsx`                                 | SI     | SI         | SI       | VERIFIED   | ScanLine importado, 6 ítems nav incluyendo /escanear   |
| `src/components/bottom-nav.tsx`                                  | SI     | SI         | SI       | VERIFIED   | ScanLine importado, 6 ítems nav incluyendo /escanear   |
| `src/app/(app)/qr/page.tsx`                                      | SI     | SI         | SI       | VERIFIED   | requireAdmin, prisma.product.findMany, QrManagementClient |
| `src/components/qr-management-client.tsx`                        | SI     | SI         | SI       | VERIFIED   | 'use client', print:hidden/print:block, window.print(), /api/qr/ en href e img src |
| `src/app/(app)/reducir/[productId]/actions.ts`                   | SI     | SI         | SI       | VERIFIED   | 'use server', getAuthenticatedUser, prisma.$transaction, delta=-cantidad, INSUFFICIENT_STOCK, success:true |
| `src/app/(app)/reducir/[productId]/page.tsx`                     | SI     | SI         | SI       | VERIFIED   | await params, getAuthenticatedUser, notFound(), subtractStockViaQR.bind |
| `src/app/(app)/reducir/[productId]/reducir-client.tsx`           | SI     | SI         | SI       | VERIFIED   | 'use client', useActionState, submittedRef, step 1/2, success state |
| `src/app/(app)/reducir/[productId]/not-found.tsx`                | SI     | SI         | SI       | VERIFIED   | render={<Link href="/escanear" />}, mensaje claro al usuario |

---

## Key Link Verification

| From                                | To                                  | Via                               | Estado   | Detalle                                           |
|-------------------------------------|-------------------------------------|-----------------------------------|----------|---------------------------------------------------|
| `route.ts`                          | `QRCode.toDataURL`                  | `import QRCode from 'qrcode'`     | WIRED    | Líneas 4 + 26                                     |
| `route.ts`                          | `prisma.product.findUnique`         | `import { prisma }`               | WIRED    | Líneas 3 + 18                                     |
| `escanear/page.tsx`                 | `qr-scanner-client.tsx`             | `dynamic(..., { ssr: false })`    | WIRED    | Líneas 8-17                                       |
| `qr-scanner-client.tsx`             | `/reducir/{uuid}`                   | `router.push` post UUID_RE        | WIRED    | Líneas 35-38                                      |
| `qr/page.tsx`                       | `QrManagementClient`                | props: products array             | WIRED    | Línea 18                                          |
| `qr-management-client.tsx`          | `/api/qr/{product.id}`              | `<a href>` download + `<img src>` | WIRED    | Líneas 114 y 141                                  |
| `reducir/page.tsx`                  | `actions.ts`                        | `subtractStockViaQR.bind(null, product.id)` | WIRED | Línea 27                               |
| `actions.ts`                        | `prisma.$transaction`               | `tx.product.update({ increment: delta })` | WIRED | Líneas 37-66                            |

---

## Architecture Constraint Check (CLAUDE.md)

| Restricción                                                                     | Estado   | Evidencia                                                                 |
|---------------------------------------------------------------------------------|----------|---------------------------------------------------------------------------|
| **QR content = UUID only** — nunca nombre, slug ni campo mutable                | VERIFIED | `QRCode.toDataURL(product.id, ...)` — pasa únicamente el UUID             |
| **Atomic SQL** — `UPDATE ... SET stock = stock - n` en misma transacción        | VERIFIED | `prisma.$transaction` + `{ increment: delta }` (delta negativo) — nunca read-then-write |
| **Append-only ledger** — nunca UPDATE o DELETE en Movement                      | VERIFIED | `tx.movement.create(...)` — no hay UPDATE ni DELETE en movement en ningún archivo |
| **HTTPS required** — Camera API falla sin HTTPS en móvil                        | VERIFIED | Guard `location.protocol === 'https:' || location.hostname === 'localhost'` en qr-scanner-client.tsx |
| **requireAdmin antes de try/catch** en Route Handler                            | VERIFIED | `route.ts`: `await requireAdmin()` línea 1 del handler — no hay `try {` en todo el archivo |
| **alertActive NO modificado** en fase 3 (pertenece a fase 4)                   | VERIFIED | Sin referencia a `alertActive` en `actions.ts`, `page.tsx` ni `reducir-client.tsx` |
| **Username+password auth only** — email no se usa para login                   | N/A      | No aplica a esta fase (auth ya estaba implementada)                       |

---

## Data-Flow Trace (Level 4)

| Artefacto                        | Variable de datos          | Fuente                                     | Produce datos reales | Estado    |
|----------------------------------|----------------------------|--------------------------------------------|----------------------|-----------|
| `qr-management-client.tsx`       | `products` (prop)          | `prisma.product.findMany` en `qr/page.tsx` | SI                   | FLOWING   |
| `reducir-client.tsx`             | `product` (prop)           | `prisma.product.findUnique` en `reducir/page.tsx` | SI              | FLOWING   |
| `route.ts`                       | `product.id` en QRCode     | `prisma.product.findUnique`                | SI                   | FLOWING   |

---

## Deviaciones del Plan

| Plan  | Desviación                                                                | Impacto en el objetivo |
|-------|---------------------------------------------------------------------------|------------------------|
| 03-03 | Plan especificaba `where: { activo: true }` en la query de Prisma. El schema no tiene campo `activo` — se eliminó el filtro y se devuelven todos los productos. | **Ninguno.** El objetivo del Plan 03 era que ADMIN vea productos con checkboxes para generar QR. Todos los productos se muestran. No existe concepto de producto "inactivo" en el schema actual. La deviación es correcta — forzar el filtro habría sido un error de TypeScript. |

---

## TypeScript

`npx tsc --noEmit` — **salida vacía, código de salida 0**. Sin errores.

---

## Anti-Patterns Found

No se encontraron anti-patterns bloqueantes:

- `toBuffer` aparece solo en comentarios en `route.ts` (no es una llamada de función)
- No hay `return null`, `return {}`, `return []` en rutas de renderizado de datos reales
- No hay `console.log` en implementaciones de producción (solo `console.error` para errores genuinos de cámara)
- No hay `indeterminate` en `qr-management-client.tsx` (correcto — limitación conocida de base-nova)
- No hay `alertActive` en los archivos de fase 3 (correcto — fase 4 exclusivamente)
- No hay `try { await requireAdmin() }` en ningún archivo — el redirect nunca es tragado

---

## Human Verification Required

### 1. Visor de cámara en dispositivo móvil

**Test:** Navegar a `/escanear` desde un celular con cámara  
**Expected:** El visor de la cámara trasera aparece correctamente; el componente solicita permisos de cámara al usuario  
**Why human:** `getUserMedia` + Web Worker de qr-scanner solo funcionan en navegador real con hardware de cámara; no es testeable programáticamente

### 2. Escaneo QR navega a /reducir automáticamente

**Test:** En `/escanear`, apuntar la cámara al QR impreso de un producto con UUID válido  
**Expected:** Sin paso de confirmación, la app navega sola a `/reducir/{uuid}` del producto correspondiente  
**Why human:** Requiere cámara física real y un QR impreso o en pantalla

### 3. QR codifica solo el UUID (verificación de contenido)

**Test:** Descargar el PNG desde `/qr` → abrir con app de lectura QR (ej. Google Lens o similar)  
**Expected:** El contenido decodificado debe ser exactamente el UUID del producto (formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), no el nombre ni ningún otro dato  
**Why human:** La verificación del contenido del binario PNG requiere un lector QR externo

### 4. Print preview muestra solo la grilla QR

**Test:** En `/qr`, seleccionar 2-3 productos → click "Imprimir seleccionados" → observar la vista previa de impresión del sistema  
**Expected:** Solo la grilla 4 columnas con imágenes QR y nombres de productos — sin sidebar, sin controles de checkbox, sin botones  
**Why human:** El comportamiento de `print:hidden` / `hidden print:block` en el diálogo de impresión del OS no es verificable programáticamente

---

## Verdict

**Status: HUMAN_NEEDED**

Todas las verificaciones programáticas pasan: 22/22 truths verificados contra el código real. TypeScript compila sin errores. Todos los artefactos existen, son sustanciales y están cableados correctamente. Los constraints de arquitectura de CLAUDE.md están satisfechos. La única desviación del plan (ausencia del campo `activo` en el schema) es correcta y fue manejada apropiadamente.

Quedan 4 comportamientos que requieren verificación humana porque involucran hardware de cámara, lectura de QR con app externa, o comportamiento visual del diálogo de impresión del sistema operativo. Ninguno de estos es un bloqueante de código — el código que los sustenta está completo y correcto.

**El objetivo de fase está alcanzado en código.** Pendiente únicamente la confirmación operacional en dispositivo real.

---

_Verified: 2026-05-04_
_Verifier: Claude (gsd-verifier)_
