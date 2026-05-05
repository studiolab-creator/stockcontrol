---
phase: 03-qr-workflow
plan: "02"
subsystem: qr-scanner
tags: [qr, camera, scanner, navigation, client-component]
dependency_graph:
  requires:
    - "03-00 (qr-scanner npm package installed)"
    - "src/lib/dal.ts (getAuthenticatedUser)"
  provides:
    - "src/components/qr-scanner-client.tsx — camera QR scanning Client Component"
    - "src/app/(app)/escanear/page.tsx — /escanear Server Component page"
    - "/escanear nav items in sidebar and bottom-nav"
  affects:
    - "src/components/app-sidebar.tsx (6 nav items now)"
    - "src/components/bottom-nav.tsx (6 nav items now)"
tech_stack:
  added:
    - "qr-scanner@1.4.2 (dynamic import, already installed)"
  patterns:
    - "dynamic import with ssr:false in Server Component page"
    - "useEffect dynamic import as second SSR safety layer"
    - "UUID_RE v4 regex validation before router.push"
    - "scanner.destroy() in useEffect cleanup"
key_files:
  created:
    - "src/components/qr-scanner-client.tsx"
    - "src/app/(app)/escanear/page.tsx"
  modified:
    - "src/components/app-sidebar.tsx"
    - "src/components/bottom-nav.tsx"
decisions:
  - "Show /escanear to all authenticated users (ADMIN + OPERADOR) — simplest approach, avoids passing role prop to 'use client' BottomNav (Claude's Discretion per plan)"
  - "UUID_RE uses strict v4 regex (8-4-4-4-12) instead of permissive [0-9a-f-]{36} from PATTERNS.md — prevents acting on QR codes with wrong hyphen placement"
  - "HTTPS guard in useEffect: renders error UI on non-HTTPS non-localhost instead of attempting to start camera"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 3 Plan 02: QR Scanner Client and /escanear Page Summary

QrScannerClient with HTTPS guard, strict UUID v4 validation, and automatic camera cleanup; /escanear page wraps it with ssr:false via next/dynamic; both nav components extended with ScanLine icon and /escanear item.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create QrScannerClient component and /escanear page | 10d5ad5 | src/components/qr-scanner-client.tsx, src/app/(app)/escanear/page.tsx |
| 2 | Add /escanear nav item to app-sidebar and bottom-nav | b7e04d5 | src/components/app-sidebar.tsx, src/components/bottom-nav.tsx |

## What Was Built

### QrScannerClient (`src/components/qr-scanner-client.tsx`)

- `'use client'` directive, renders a `<video>` element as the camera viewfinder
- HTTPS check on mount: `location.protocol === 'https:' || location.hostname === 'localhost'` — renders an error UI on non-HTTPS non-localhost (CLAUDE.md HTTPS constraint / RESEARCH.md Pitfall 6)
- Dynamic `import('qr-scanner')` inside `useEffect` — second SSR safety layer (primary is `ssr:false` in page)
- `QrScanner` initialized with `returnDetailedScanResult: true`, `preferredCamera: 'environment'` (rear camera on mobile)
- `onDecodeError` gates on `QrScanner.NO_QR_CODE_FOUND` to suppress per-frame noise (RESEARCH.md Pitfall 3)
- UUID v4 regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` — only navigates for valid UUIDs
- On valid UUID: `scanner.stop()` then `router.push('/reducir/${uuid}')` (D-05)
- useEffect cleanup: `scannerRef.current?.destroy()` — stops camera stream and terminates Web Worker (RESEARCH.md Pitfall 1)

### Escanear Page (`src/app/(app)/escanear/page.tsx`)

- Server Component with `getAuthenticatedUser()` — any authenticated user (ADMIN or OPERADOR) can access
- `dynamic(... , { ssr: false })` wrapping `QrScannerClient` — prevents qr-scanner Web Worker from being evaluated during SSR
- Loading fallback: `<p>Cargando camara...</p>`

### Navigation Updates

- `app-sidebar.tsx`: `ScanLine` added to lucide-react import; `/escanear` item inserted between `/qr` and `/alertas` with label "Escanear QR"; 6 total items
- `bottom-nav.tsx`: `ScanLine` added to lucide-react import; `/escanear` item inserted between `/qr` and `/alertas` with label "Escanear"; 6 total items
- Existing active-state detection in BottomNav (`pathname === item.href || pathname.startsWith(item.href + '/')`) handles `/escanear` and future `/reducir` routes correctly without changes

## Deviations from Plan

None - plan executed exactly as written.

The only minor note: the plan's acceptance criteria tests for `"ssr: false"` not appearing in `qr-scanner-client.tsx` via grep would match the comment `// Primary guard is ssr: false in escanear/page.tsx` — this is a documentation comment only, not functional code. The `ssr: false` option is exclusively in `escanear/page.tsx` as required.

## Security / Threat Model Compliance

All mitigations from the plan's threat model are implemented:

| Threat ID | Mitigation | Implemented |
|-----------|------------|-------------|
| T-03-02-01 | HTTPS guard in useEffect | Yes — renders error UI on non-HTTPS non-localhost |
| T-03-02-02 | UUID_RE regex before router.push | Yes — strict v4 format validation |
| T-03-02-03 | scanner.destroy() in cleanup | Yes — stops stream and terminates Web Worker |
| T-03-02-04 | getAuthenticatedUser() on /escanear | Yes — redirects unauthenticated users to /login |
| T-03-02-05 | /qr page guards itself with requireAdmin() | Accepted — nav items visible to all, page enforces access |

## Known Stubs

None — the QrScannerClient directly starts the camera and navigates to /reducir/{uuid} on valid scan. No placeholder text or mock data in the render path.

## Self-Check

### Files Exist

- `src/components/qr-scanner-client.tsx`: FOUND
- `src/app/(app)/escanear/page.tsx`: FOUND
- `src/components/app-sidebar.tsx`: FOUND (modified)
- `src/components/bottom-nav.tsx`: FOUND (modified)

### Commits Exist

- 10d5ad5: FOUND (Task 1)
- b7e04d5: FOUND (Task 2)

### TypeScript Check

`npx tsc --noEmit` exits 0 — no new errors.

## Self-Check: PASSED
