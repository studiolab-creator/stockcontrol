# Requirements: StockControl

**Defined:** 2026-05-06
**Core Value:** Saber exactamente cuánto stock hay de cada producto en todo momento, sin desfasajes entre lo físico y el sistema.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: Usuario puede hacer login con username + password
- [x] **AUTH-02**: Email no es el identificador de login (solo username); email existe solo en AlertConfig para notificaciones
- [x] **AUTH-03**: Roles ADMIN y OPERADOR con acceso diferenciado (ADMIN: gestión completa; OPERADOR: solo reducir stock vía QR)

### Product Catalog

- [x] **PROD-01**: ADMIN puede crear, editar y eliminar productos (tipo TERMINADO o INSUMO)
- [x] **PROD-02**: Producto tiene UUID inmutable como ID (nunca nombre ni slug en QR codes)
- [x] **PROD-03**: Categorías opcionales gestionadas por ADMIN; asignación opcional por producto (una categoría por producto)
- [x] **PROD-04**: Cada producto tiene `minStock` como umbral de alerta de stock bajo

### Stock Engine

- [x] **STOCK-01**: ADMIN puede registrar entrada de stock manualmente
- [x] **STOCK-02**: Salida de stock atómica: `UPDATE ... SET stock = stock - n WHERE stock >= n` en la misma transacción que el insert de movement — nunca read-then-write
- [x] **STOCK-03**: Tabla `movements` append-only: sin UPDATE ni DELETE en filas de movimiento
- [x] **STOCK-04**: Dashboard muestra stock actual de todos los productos en tiempo real

### QR Workflow

- [x] **QR-01**: ADMIN genera QR para productos (PNG descargable desde /api/qr/{uuid})
- [x] **QR-02**: El QR codifica SOLO el UUID del producto — nunca nombre, slug ni campo mutable
- [x] **QR-03**: Escanear QR con UUID válido navega automáticamente a /reducir/{uuid} sin paso de confirmación
- [x] **QR-04**: /escanear requiere HTTPS — Camera API (getUserMedia) falla sin HTTPS en móvil; se muestra error si no hay HTTPS fuera de localhost

### Alerts

- [ ] **ALERT-01**: Cuando el stock de un producto cae por debajo de `minStock`, se envía email (via Resend) a los destinatarios configurados en `AlertConfig`
- [ ] **ALERT-02**: `alertActive` flag evita emails duplicados — se dispara una sola vez por cruce descendente; no se vuelve a enviar mientras `alertActive` es `true`
- [ ] **ALERT-03**: `alertActive` se resetea a `false` cuando el stock sube por encima de `minStock` — permite que el próximo cruce descendente dispare un nuevo email
- [ ] **ALERT-04**: ADMIN puede configurar la lista de emails receptores por producto en la sección /alertas
- [ ] **ALERT-05**: Indicadores visuales (badge/color) en dashboard y catálogo muestran productos actualmente en alerta (alertActive = true)

## Out of Scope

Explicitly excluded from v1.

| Feature | Reason |
|---------|--------|
| Login por email | Auth identifier es username+password — el email es solo para notificaciones (CLAUDE.md constraint) |
| Importación masiva de inventario | Fuera del alcance del equipo interno de 3-10 personas |
| App nativa (iOS/Android) | Web responsive via HTTPS |
| Múltiples almacenes/ubicaciones | Un solo inventario centralizado |
| Integración con sistemas externos (ERP, etc.) | Scope limitado a control interno |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Done |
| AUTH-02 | Phase 1 | Done |
| AUTH-03 | Phase 1 | Done |
| PROD-01 | Phase 1 | Done |
| PROD-02 | Phase 1 | Done |
| PROD-03 | Phase 1 | Done |
| PROD-04 | Phase 1 | Done |
| STOCK-01 | Phase 2 | Done |
| STOCK-02 | Phase 2 | Done |
| STOCK-03 | Phase 2 | Done |
| STOCK-04 | Phase 2 | Done |
| QR-01 | Phase 3 | Done |
| QR-02 | Phase 3 | Done |
| QR-03 | Phase 3 | Done |
| QR-04 | Phase 3 | Done |
| ALERT-01 | Phase 4 | Pending |
| ALERT-02 | Phase 4 | Pending |
| ALERT-03 | Phase 4 | Pending |
| ALERT-04 | Phase 4 | Pending |
| ALERT-05 | Phase 4 | Pending |
