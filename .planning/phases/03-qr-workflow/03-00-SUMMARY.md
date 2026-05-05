---
phase: 03-qr-workflow
plan: "00"
subsystem: dependencies
tags: [npm, css, qr, print]
dependency_graph:
  requires: []
  provides:
    - qr-scanner@1.4.2 importable from any component
    - qrcode@1.5.4 importable from server actions
    - "@types/qrcode TypeScript types available"
    - "@media print A4 layout in globals.css"
  affects:
    - 03-01-PLAN.md (QR generation depends on qrcode)
    - 03-02-PLAN.md (QR scanning depends on qr-scanner)
    - 03-03-PLAN.md (print layout depends on @media print CSS)
tech_stack:
  added:
    - qr-scanner@1.4.2
    - qrcode@1.5.4
    - "@types/qrcode@1.5.6"
  patterns:
    - "@media print with @page A4 for QR sheet layout"
key_files:
  created:
    - package-lock.json
  modified:
    - package.json
    - src/app/globals.css
decisions:
  - "@custom-variant print NOT added — built-in to Tailwind v4"
  - "No body > * display:none rule — would cause React hydration errors (RESEARCH.md Pitfall 7)"
  - "Hiding app chrome delegated to print:hidden on SidebarProvider in QrManagementClient"
metrics:
  duration: "3 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 03 Plan 00: Dependencias QR e impresion CSS

Instalacion de tres paquetes npm requeridos por el flujo QR y adicion de la regla @media print A4 a globals.css. Sin esta base, los planes 03-01 a 03-04 no pueden importar ni qrcode ni qr-scanner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install qr-scanner, qrcode, @types/qrcode | e633a45 | package.json, package-lock.json |
| 2 | Add @media print CSS rule to globals.css | 2bc63b4 | src/app/globals.css |

## What Was Built

- `qr-scanner@1.4.2` instalado en dependencies (escaneo QR en browser via camara)
- `qrcode@1.5.4` instalado en dependencies (generacion de QR PNG en servidor)
- `@types/qrcode@1.5.6` instalado en dependencies (tipos TypeScript para qrcode)
- Regla `@media print { @page { size: A4; margin: 10mm; } }` agregada al final de globals.css

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito.

## Verification Results

```
"qr-scanner": "^1.4.2"   ✓ en package.json
"qrcode": "^1.5.4"        ✓ en package.json
"@types/qrcode": "^1.5.6" ✓ en package.json
node_modules/qr-scanner/qr-scanner.min.js  ✓ existe
node_modules/qrcode/lib/index.js           ✓ existe
@media print { ... size: A4 ... }          ✓ en globals.css
@custom-variant print                      ✓ NO presente (correcto)
body > * { display: none }                 ✓ NO presente (correcto)
```

## Known Stubs

None.

## Threat Flags

None - solo instalacion de paquetes y CSS sin superficie de red nueva.

## Self-Check: PASSED

- package.json: contiene los tres paquetes nuevos
- package-lock.json: creado con pins exactos de version
- src/app/globals.css: contiene @media print con size: A4 y margin: 10mm
- Commit e633a45: verificado en git log
- Commit 2bc63b4: verificado en git log
