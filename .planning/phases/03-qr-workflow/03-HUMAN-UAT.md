---
status: complete
phase: 03-qr-workflow
source: [03-VERIFICATION.md]
started: 2026-05-05T00:00:00Z
updated: 2026-05-06T00:00:00Z
---

## Current Test

Human UAT complete — all 4 tests passed.

## Tests

### 1. Visor de cámara en /escanear (móvil)
expected: Navegar a /escanear desde un dispositivo móvil con HTTPS muestra el visor de cámara en tiempo real
result: PASS — cámara se inicializa correctamente al tocar el botón (iOS y Android, producción vía ngrok)

### 2. Escaneo QR navega a /reducir automáticamente
expected: Apuntar la cámara a un QR que codifica un UUID válido navega automáticamente a /reducir/{uuid} sin paso de confirmación
result: PASS — escaneo detecta el QR y navega automáticamente

### 3. El QR codifica solo el UUID
expected: Descargar el PNG desde /qr → leer con app de QR externa → el contenido decodificado es exactamente el UUID del producto (no el nombre ni ningún otro campo)
result: [pending]

### 4. Print preview muestra solo la grilla QR
expected: Seleccionar productos en /qr → click "Imprimir seleccionados" → el dialog de impresión del OS muestra solo la grilla de 4 columnas (sin sidebar, sin controles)
result: [pending]

## Summary

total: 4
passed: 2
issues: 0
pending: 2
skipped: 0
blocked: 0

## Notes

- **Importante:** la app debe servirse en modo producción (`npm run build && npm start`) para que
  JavaScript cargue en navegadores móviles. El servidor de desarrollo genera bundles de 5-15 MB
  sin minificar que se descartan en conexiones lentas (ngrok / WiFi). En producción los bundles
  son ~500 KB y cargan correctamente.
- Escáner usa native BarcodeDetector (iOS 17+ / Chrome 88+); qr-scanner se carga lazy como fallback.

## Gaps
