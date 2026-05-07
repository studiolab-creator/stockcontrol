# Roadmap: StockControl

## Overview

Sistema web de control de stock para equipo interno (3-10 personas). El roadmap va desde la fundación (auth + catálogo) hasta el flujo QR completo con alertas de stock bajo. Phases 1-3 completas; Phase 4 (Alerts) es el último tramo.

## Phases

- [x] **Phase 1: Foundation** - Auth (username+password), catálogo de productos con categorías, roles ADMIN/OPERADOR
- [x] **Phase 2: Core Ledger** - Motor de stock atómico, historial de movimientos, dashboard
- [x] **Phase 3: QR Workflow** - Generación de QR, pantalla de impresión, escáner de cámara, reducción atómica vía QR
- [x] **Phase 4: Alerts** - Email de stock bajo con dedup, indicadores visuales, configuración por producto

## Phase Details

### Phase 1: Foundation
**Goal**: El equipo puede autenticarse (username + password) y el ADMIN puede gestionar el catálogo completo de productos e insumos con categorías.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, PROD-01, PROD-02, PROD-03, PROD-04
**Status**: Done ✓
**Success Criteria** (what must be TRUE):
  1. Usuario puede hacer login con username+password; email no se usa para auth
  2. ADMIN puede crear, editar y eliminar productos (tipo TERMINADO o INSUMO) con categoría opcional
  3. OPERADOR ve el catálogo pero no puede administrar productos
  4. UUID del producto es inmutable desde creación

Plans:
- [x] Completed

---

### Phase 2: Core Ledger
**Goal**: El stock se mantiene exacto en todo momento: ADMIN puede registrar entradas, las salidas son atómicas, y el historial de movimientos es append-only y visible.
**Depends on**: Phase 1
**Requirements**: STOCK-01, STOCK-02, STOCK-03, STOCK-04
**Status**: Done ✓
**Success Criteria** (what must be TRUE):
  1. ADMIN registra entrada de stock manualmente; stock del producto se actualiza con UPDATE atómico
  2. Stock nunca queda negativo — la transacción hace rollback si stock < cantidad solicitada
  3. Cada movimiento genera un registro en `movements` (append-only, sin UPDATE ni DELETE)
  4. Dashboard muestra stock actual de todos los productos

Plans:
- [x] Completed

---

### Phase 3: QR Workflow
**Goal**: El flujo QR está completo: ADMIN puede generar e imprimir QR para productos; escanear un QR navega automáticamente a la página de reducción de stock; la reducción es atómica y append-only.
**Depends on**: Phase 2
**Requirements**: QR-01, QR-02, QR-03, QR-04, STOCK-02
**Status**: Done ✓ (verified 2026-05-04, UAT complete)
**Success Criteria** (what must be TRUE):
  1. GET /api/qr/{uuid} retorna PNG que codifica SOLO el UUID del producto
  2. Escanear QR con UUID válido navega a /reducir/{uuid} sin paso de confirmación
  3. /escanear muestra error si no hay HTTPS (fuera de localhost)
  4. Reducción de stock en /reducir es atómica (prisma.$transaction) y crea Movement con motivo='Escaneo QR'

Plans:

Wave 1 — Base dependencies:
- [x] 03-00: Install qr-scanner + qrcode, add @media print CSS
- [x] 03-01: /api/qr/[productId] — QR PNG generation endpoint
- [x] 03-02: /escanear — QR scanner page with camera

Wave 2 *(blocked on Wave 1 completion)*:
- [x] 03-03: /qr — QR management page (ADMIN: select + download + print)
- [x] 03-04: /reducir/[productId] — atomic stock reduction via QR

---

### Phase 4: Alerts
**Goal**: Las alertas de stock bajo funcionan end-to-end: cuando el stock cae por debajo de `minStock` se envía email (Resend) una sola vez por cruce descendente; `alertActive` se resetea cuando el stock se recupera; indicadores visuales en dashboard y catálogo muestran los productos en alerta; ADMIN configura el email receptor global en /alertas.
**Depends on**: Phase 3
**Requirements**: ALERT-01, ALERT-02, ALERT-03, ALERT-04, ALERT-05
**Status**: Done ✓ (verified 2026-05-07, UAT complete)
**Success Criteria** (what must be TRUE):
  1. Al reducir stock bajo minStock, se envía email via Resend al email global configurado en AppConfig, y alertActive se setea a true ✓
  2. No se envía email duplicado mientras alertActive = true (dedup funcionando) ✓
  3. Al subir stock sobre minStock, alertActive se resetea a false ✓
  4. ADMIN puede ver y editar el email receptor global en /alertas ✓
  5. Productos con stock <= minStock muestran badge "Stock bajo" en /dashboard y /productos ✓
**Plans**: 6 plans in 4 waves

Plans:

Wave 0 — Infrastructure:
- [x] 04-00-PLAN.md — Install resend, add AppConfig model to schema, db push + prisma generate

Wave 1 — Email utility:
- [x] 04-01-PLAN.md — Create src/lib/email.ts with sendLowStockAlertWithRetry()

Wave 2 — Alert logic in stock actions (parallel):
- [x] 04-02-PLAN.md — Add alertActive CAS + email to subtractStockViaQR (QR path)
- [x] 04-03-PLAN.md — Add alertActive CAS + email + reset to addStockMovement (manual path)

Wave 3 — UI (parallel):
- [x] 04-04-PLAN.md — /alertas page + saveGlobalAlertEmail Server Action
- [x] 04-05-PLAN.md — Add Stock column + low-stock badge to /productos catalog
