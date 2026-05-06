# Phase 4: Alerts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-alerts
**Areas discussed:** Trigger de alerta, Visual indicators, Email config UI, Email template

---

## Trigger de alerta

| Option | Description | Selected |
|--------|-------------|----------|
| Ambas mutaciones | QR scan Y reducción manual del dashboard | ✓ |
| Solo QR scan | Solo subtractStockViaQR | |
| Helper común | checkAndFireAlert() compartido | |

**User's choice:** Ambas mutaciones
**Notes:** Cualquier reducción puede cruzar el umbral — cubrirlas garantiza que ningún cruce se pierda.

| Option | Description | Selected |
|--------|-------------|----------|
| Al subir stock sobre minStock | Reset automático | ✓ |
| Solo reset manual ADMIN | Botón en /alertas | |
| Ambos (auto + manual) | | |

**User's choice:** Reset automático cuando newStock > minStock

| Option | Description | Selected |
|--------|-------------|----------|
| stock < minStock (estricto) | Stock igual al mínimo no dispara | ✓ |
| stock <= minStock | Igual que el visual del dashboard | |

**User's choice:** `stock < minStock` (estricto)

| Option | Description | Selected |
|--------|-------------|----------|
| Fuera de la transacción | Stock commit siempre; email post-commit | ✓ |
| Dentro de la transacción | Si Resend falla, rollback del stock | |

**User's choice:** Fuera de la transacción + mecanismo de reintento para emails fallidos.
**Notes:** El usuario aclaró que quiere un "reaseguro para reenviar un mail que no se envió correctamente" — detalles del retry delegados al planner.

---

## Visual indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Mantener stock <= minStock | Sin cambios en lógica actual | ✓ |
| Cambiar a alertActive | Solo muestra cuando email disparado | |

**User's choice:** Mantener `stock <= minStock` para el visual — sin cambios al dashboard existente.

| Option | Description | Selected |
|--------|-------------|----------|
| Solo dashboard | No agregar en otros lugares | |
| Dashboard + /productos | Ambas vistas | ✓ |
| Dashboard + /productos + sidebar/nav | Indicador global en nav | |

**User's choice:** Dashboard + `/productos` (catálogo)

---

## Email config UI

**Clarificación clave del usuario:** Un solo email global de destino para todos los productos (no por producto). Simplifica completamente el modelo — `AlertConfig` per-producto del schema no se usa para este propósito.

| Option | Description | Selected |
|--------|-------------|----------|
| Campo email + productos en alerta | Email global arriba, tabla alertActive abajo | ✓ |
| Solo campo de email | Minimalista | |
| Campo email + todos los productos | Tabla completa | |

**User's choice:** Campo de email global + tabla de productos con `alertActive = true`

---

## Email template

| Option | Description | Selected |
|--------|-------------|----------|
| HTML simple | Con formato básico, sin branding | ✓ |
| Texto plano | Sin formato | |
| HTML con branding | Logo, colores del sistema | |

**User's choice:** HTML simple

**Contenido seleccionado (multiSelect):** Nombre del producto ✓, Stock actual + mínimo ✓, Tipo de movimiento ✓, Link directo al producto ✓

**Subject:** `⚠️ Stock bajo: {nombre del producto}`

---

## Claude's Discretion

- Número de reintentos y backoff para emails fallidos
- Modelo/mecanismo para almacenar el email global (AppConfig u otro)
- Estado vacío en /alertas cuando no hay productos con alertActive = true
- Comportamiento cuando no hay email global configurado y se dispara alerta

## Deferred Ideas

None — la discusión se mantuvo dentro del scope de Phase 4.
