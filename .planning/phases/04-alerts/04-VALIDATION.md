---
phase: 4
slug: alerts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework installed in project |
| **Config file** | none — Wave 0 does NOT install a test framework |
| **Quick run command** | `npx tsc --noEmit` (type-check only) |
| **Full suite command** | `npm run build` (full build verification) |
| **Estimated runtime** | ~30 seconds (build) |

**Note:** This project has no automated test framework (no Jest, Vitest, or Playwright). All behavioral validation for this phase is manual smoke testing. The plan must include explicit manual verification steps for each requirement.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full build must be green + manual smoke test checklist complete
- **Max feedback latency:** ~30 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | — | — | N/A | manual | `npm install resend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-01-01 | 01 | 1 | ALERT-01, ALERT-02 | T-04-01 | alertActive CAS prevents duplicate sends | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | ALERT-03 | — | reset only on stock > minStock | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | ALERT-01, ALERT-02 | T-04-01 | same CAS pattern in QR path | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 1 | ALERT-04 | T-04-02 | requireAdmin() enforced | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 1 | ALERT-04 | T-04-02 | email Zod validation rejects non-email | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-04-01 | 04 | 2 | ALERT-05 | — | badge uses stock <= minStock, not alertActive | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-04-02 | 04 | 2 | ALERT-05 | — | badge appears in /productos | manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install resend` — ALERT-01 email delivery
- [ ] Verify `RESEND_API_KEY` in `.env.local` — document where to obtain (resend.com/api-keys)
- [ ] `npx prisma db push` after adding AppConfig model — ALERT-04 persistence
- [ ] `npx prisma generate` after db push — regenerate client with AppConfig

*No test stubs needed — no test framework installed. Wave 0 is infra/deps only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email sent when stock crosses below minStock | ALERT-01 | Requires live Resend API key + DB; no test framework | 1. Reduce product stock below minStock via /reducir. 2. Check email inbox. 3. Verify email subject = "⚠️ Stock bajo: {nombre}". 4. Verify email contains stock, minStock, motivo, link. |
| No duplicate email when alertActive=true | ALERT-02 | Requires live email + DB state | After ALERT-01 test: reduce same product further. Verify NO second email arrives. |
| alertActive resets when stock rises above minStock | ALERT-03 | Requires DB state verification | After ALERT-02 test: add stock above minStock from /productos/{id}. Check DB: `alertActive` should be `false`. |
| ADMIN can save global email; email validates | ALERT-04 | Requires browser UI + DB | 1. Go to /alertas as ADMIN. 2. Enter invalid email → verify error shown. 3. Enter valid email → verify saved. 4. Check DB AppConfig row with key='alert_email'. |
| OPERADOR cannot access /alertas | ALERT-04 | Role auth check | Log in as OPERADOR. Navigate to /alertas. Verify redirect to /dashboard. |
| Visual badge in /productos for low-stock items | ALERT-05 | Visual UI check | Set a product's stock ≤ minStock. Go to /productos. Verify "Stock bajo" red badge appears for that product. |
| Visual badge in /dashboard for low-stock items | ALERT-05 | Confirm existing behavior unchanged | Verify dashboard still shows badge — regression check only, no code change needed. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (tsc covers all)
- [ ] Wave 0 covers all MISSING references (resend install + db push)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (tsc --noEmit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
