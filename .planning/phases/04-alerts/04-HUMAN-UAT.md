---
status: partial
phase: 04-alerts
source: [04-VERIFICATION.md]
started: 2026-05-07T00:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Email delivery — QR path
expected: Reducing a product's stock below minStock via QR scan sends an email to the configured alert_email address; alertActive becomes true; a second QR scan does NOT send a second email
result: [pending]

### 2. Email delivery + reset cycle — manual path
expected: Manual stock reduction crossing minStock sends email (motivo "Entrada manual"); subsequent manual entry restoring stock to >= minStock resets alertActive to false; a new reduction below minStock fires a fresh email
result: [pending]

### 3. OPERADOR redirect at /alertas
expected: Logged-in OPERADOR visiting /alertas is redirected to /dashboard; ADMIN can access the page and see the email form and alerts table
result: [pending]

### 4. Toast/spinner interaction at /alertas email form
expected: Submitting a valid email shows Loader2 spinner on the button while pending, then toast.success("Email guardado"); submitting an invalid email shows inline "Ingresá un email válido." without a toast
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
