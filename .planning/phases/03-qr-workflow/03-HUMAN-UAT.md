---
status: partial
phase: 03-qr-workflow
source: [03-VERIFICATION.md]
started: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visor de cámara en /escanear (móvil)
expected: Navegar a /escanear desde un dispositivo móvil con HTTPS muestra el visor de cámara en tiempo real
result: [pending]

### 2. Escaneo QR navega a /reducir automáticamente
expected: Apuntar la cámara a un QR que codifica un UUID válido navega automáticamente a /reducir/{uuid} sin paso de confirmación
result: [pending]

### 3. El QR codifica solo el UUID
expected: Descargar el PNG desde /qr → leer con app de QR externa → el contenido decodificado es exactamente el UUID del producto (no el nombre ni ningún otro campo)
result: [pending]

### 4. Print preview muestra solo la grilla QR
expected: Seleccionar productos en /qr → click "Imprimir seleccionados" → el dialog de impresión del OS muestra solo la grilla de 4 columnas (sin sidebar, sin controles)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
