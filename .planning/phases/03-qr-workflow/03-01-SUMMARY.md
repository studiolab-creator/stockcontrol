---
phase: 03-qr-workflow
plan: "01"
subsystem: api
tags: [route-handler, qr-generation, auth, binary-response]
dependency_graph:
  requires:
    - src/lib/dal.ts (requireAdmin)
    - src/lib/prisma.ts (prisma singleton)
    - qrcode (npm)
  provides:
    - GET /api/qr/[productId] -> PNG binary
  affects:
    - src/app/(app)/qr/ (future Plan 03: download link + print sheet img tags)
tech_stack:
  added: []
  patterns:
    - Next.js 16 Route Handler with binary PNG response
    - params as Promise<{...}> (Next.js 16 breaking change)
    - QRCode.toDataURL() -> base64 strip -> Buffer.from() pattern
key_files:
  created:
    - src/app/api/qr/[productId]/route.ts
  modified: []
decisions:
  - Cache-Control immutable set because product UUID never changes; stale cache returns 404 if product deleted
  - errorCorrectionLevel M (15% recovery) — good balance for printed labels
  - width 300px / margin 2 — compact quiet zone for dense grids without losing scannability
metrics:
  duration: "~10 minutes"
  completed: "2026-05-04"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 03 Plan 01: QR Route Handler — PNG Binary Response Summary

GET Route Handler at `/api/qr/[productId]` returns a 300x300px PNG QR code encoding the immutable product UUID, authenticated to ADMIN role only, with immutable cache headers.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create GET Route Handler for QR PNG generation | df0ac89 | done |

## Implementation Details

**File created:** `src/app/api/qr/[productId]/route.ts`

Key implementation decisions applied:

1. `requireAdmin()` is the first awaited call — before any `try/catch`. This ensures `redirect()` (which throws internally) propagates correctly. No `try` blocks exist in the file at all.
2. `const { productId } = await params` — Next.js 16 breaking change: params is a Promise.
3. `prisma.product.findUnique({ select: { id: true } })` — only the UUID is fetched; `notFound()` for unknown UUIDs.
4. `QRCode.toDataURL(product.id, ...)` — encodes the immutable UUID only. Name, slug, and all mutable fields are excluded (CLAUDE.md hard constraint).
5. `toDataURL()` → strip `data:image/png;base64,` prefix → `Buffer.from(b64, 'base64')` — no `toBuffer()` call (that method does not exist in qrcode 1.5.x).
6. Response: `Content-Type: image/png`, `Content-Disposition: attachment; filename="qr-{uuid}.png"`, `Cache-Control: public, max-age=31536000, immutable`.

## Deviations from Plan

None — plan executed exactly as written. The `toBuffer` string appears in two comment lines explaining the pitfall; no `toBuffer()` function call exists in the code.

## Threat Surface Scan

All threats from plan's threat model are mitigated:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-03-01-01: Elevation of Privilege | `requireAdmin()` at line 1 of handler body, before any try/catch |
| T-03-01-02: Tampering (crafted productId) | Prisma parameterizes all values; unknown UUID → `notFound()` (404) |
| T-03-01-03: Information Disclosure (QR content) | `QRCode.toDataURL(product.id)` — UUID only, no mutable fields |
| T-03-01-04: Spoofing (Cache-Control immutable) | Accepted — UUID is immutable; deleted products return 404 even from cache |

No new threat surface introduced beyond what the plan documented.

## Known Stubs

None. The Route Handler is fully functional — it queries the real database, generates a real PNG, and returns it. No placeholder data or mock responses.

## Self-Check

- [x] `src/app/api/qr/[productId]/route.ts` exists
- [x] Commit `df0ac89` exists (`git log --oneline | grep df0ac89`)
- [x] `npx tsc --noEmit` exits 0 (no errors)
- [x] `requireAdmin()` appears before any `try` block (no `try` blocks in file)
- [x] `toBuffer` appears only in comments, not in executable code

## Self-Check: PASSED
