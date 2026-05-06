# Phase 4: Alerts - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementar el sistema de alertas de stock bajo end-to-end: cuando el stock de un producto cae por debajo de `minStock`, se envía un email (Resend) a un destinatario global configurado en `/alertas`, una sola vez por cruce descendente. `alertActive` se resetea automáticamente cuando el stock se recupera. Los indicadores visuales del dashboard y catálogo ya existen — no requieren cambios. La página `/alertas` reemplaza el placeholder con UI real para configurar el email global y ver qué productos están actualmente en alerta.

</domain>

<decisions>
## Implementation Decisions

### Trigger de alerta

- **D-01:** La lógica de `alertActive` se ejecuta en **ambas** mutaciones de stock: `subtractStockViaQR` (flujo QR en `/reducir`) Y `addStockMovement` (entrada/reducción manual desde el dashboard). Cualquier reducción puede cruzar el umbral — cubrirlas a las dos garantiza que ningún cruce se pierda.
- **D-02:** Umbral de disparo **estricto**: `newStock < minStock`. Stock igual al mínimo no dispara alerta. (El visual del dashboard usa `<=` y no cambia — son señales diferentes.)
- **D-03:** `alertActive` se resetea a `false` **automáticamente** cuando el nuevo stock sube por encima de `minStock` (`newStock > minStock`). Se produce en la mutación de entrada de stock (`addStockMovement`). No hay reset manual por ADMIN.
- **D-04:** El email se envía **fuera de la transacción de Prisma**. Flujo: primero commit el stock + `alertActive = true` dentro de la transacción, luego llamar a Resend. Si Resend falla, el stock ya está actualizado y `alertActive = true` evita duplicados. Agregar mecanismo de reintento para emails fallidos (número de intentos y estrategia de backoff: decisión del planner).

### Visual indicators

- **D-05:** Los indicadores visuales ("Stock bajo" badge + borde rojo en cards) **no cambian** — siguen basados en `stock <= minStock`, tal como está implementado en `DashboardClient` hoy. `alertActive` no controla el visual.
- **D-06:** Los indicadores visuales deben aparecer en **dashboard** (`/dashboard`) Y **catálogo de productos** (`/productos`). El dashboard ya los tiene; `/productos` necesita incorporar el mismo patrón de badge.

### Email de destino

- **D-07:** **Un solo email global de destino** para todas las alertas — no por producto. El modelo `AlertConfig` per-product del schema actual **no se usa** para este propósito. Se necesita almacenar un email global (nuevo modelo `AppConfig` u otro mecanismo: decisión del planner). El email se configura desde la UI de `/alertas`.
- **D-08:** La validación del campo de email global debe rechazar valores que no sean emails válidos antes de guardar.

### UI de /alertas

- **D-09:** La página `/alertas` reemplaza el placeholder y muestra:
  1. **Sección superior:** Campo de email global (input + botón guardar). Solo ADMIN puede acceder.
  2. **Sección inferior:** Tabla de productos con `alertActive = true`, mostrando nombre del producto, stock actual, y stock mínimo.
- **D-10:** `/alertas` es exclusiva de ADMIN (`requireAdmin()`). OPERADOR redirige a `/dashboard`.

### Email template

- **D-11:** Formato **HTML simple** — sin branding complejo, legible en cualquier cliente de email.
- **D-12:** Subject: `⚠️ Stock bajo: {nombre del producto}`
- **D-13:** Contenido del email incluye:
  - Nombre del producto
  - Stock actual y mínimo (ej. "Stock actual: 3 / Mínimo: 10")
  - Tipo de movimiento que causó la alerta ("Escaneo QR" o "Entrada manual")
  - Link directo a `/productos/{id}` del producto

### Claude's Discretion

- Número exacto de reintentos y estrategia de backoff para emails fallidos (ej. 3 intentos con 1s entre cada uno)
- Cómo almacenar el email global: nuevo modelo Prisma `AppConfig { key String @unique; value String }` o similar
- Qué mostrar en `/alertas` cuando no hay productos con `alertActive = true` (estado vacío)
- Cómo manejar el caso de que no haya email global configurado cuando se dispara una alerta (silenciar o loguear)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema y constraints de arquitectura
- `prisma/schema.prisma` — Definición de `alertActive Boolean @default(false)` en Product y modelo `AlertConfig`. IMPORTANTE: `AlertConfig` per-producto NO se usa para el email global — ver D-07.
- `CLAUDE.md` / `AGENTS.md` — Constraints de arquitectura: alertActive dedup, atomic SQL, append-only ledger, HTTPS, auth.

### Requisitos de la fase
- `.planning/REQUIREMENTS.md` — ALERT-01 a ALERT-05 (los 5 requisitos de esta fase)
- `.planning/ROADMAP.md` — Phase 4 goal y success criteria

### Stock mutations existentes (donde va la lógica de alertActive)
- `src/app/(app)/reducir/[productId]/actions.ts` — `subtractStockViaQR`: aquí se agrega la lógica de alertActive post-transacción para bajas de stock vía QR
- `src/app/(app)/productos/[id]/actions.ts` — `addStockMovement`: aquí se agrega la lógica de alertActive (disparo en reducción manual, reset en entrada de stock)

### Patrones visuales existentes
- `src/components/dashboard-client.tsx` — `isLowStock` helper (`stock <= minStock`), uso de `Badge variant="destructive"` y `border-destructive`. El `/productos` catálogo debe replicar este patrón.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` (`src/components/ui/badge.tsx`) — `variant="destructive"` ya se usa para "Stock bajo" en el dashboard. Mismo componente para `/productos`.
- `requireAdmin()` / `getAuthenticatedUser()` (`src/lib/dal.ts`) — Patrón de auth para Server Components y Actions. `/alertas` usa `requireAdmin()`.
- `prisma.$transaction` — Patrón establecido. La lógica de `alertActive` y email van fuera del transaction block, después del commit.
- `revalidatePath()` — Patrón para invalidar caché después de mutaciones.

### Established Patterns
- Server Actions con `'use server'`, validación Zod, `getAuthenticatedUser()` al inicio — este patrón se replica en la acción de guardar email global.
- `isLowStock` en DashboardClient: `p.stock <= p.minStock` — no cambia; el visual se mantiene igual.
- Prisma client generado en `src/generated/prisma/` (no `@prisma/client`).

### Integration Points
- `subtractStockViaQR` en `reducir/[productId]/actions.ts` — agregar lógica de alerta post-commit (D-01, D-04)
- `addStockMovement` en `productos/[id]/actions.ts` — agregar lógica de alerta post-commit y reset (D-01, D-03)
- `/alertas/page.tsx` — reemplazar placeholder con Server Component que carga email global + productos en alerta
- `/productos` — agregar indicador visual "Stock bajo" siguiendo el patrón de `DashboardClient` (D-06)

</code_context>

<specifics>
## Specific Ideas

- Subject exacto del email: `⚠️ Stock bajo: {nombre del producto}` (ver D-12)
- El email debe incluir el tipo de movimiento que causó la alerta — esto requiere pasar el `motivo` ("Escaneo QR" / "Entrada manual") a la función de envío
- Reset de `alertActive` solo cuando `newStock > minStock` (no cuando `newStock === minStock`)

</specifics>

<deferred>
## Deferred Ideas

None — la discusión se mantuvo dentro del scope de Phase 4.

</deferred>

---

*Phase: 4-alerts*
*Context gathered: 2026-05-06*
