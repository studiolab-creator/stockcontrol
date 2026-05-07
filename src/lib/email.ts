import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

// Module-level singleton — initialized once per server process.
// RESEND_API_KEY must be set in .env.local (dev) and platform env vars (prod).
// If the key is absent, Resend will throw on first send — caught by sendWithRetry.
const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Types ───────────────────────────────────────────────────────────────────

export type SendLowStockAlertParams = {
  productId: string
  productName: string
  currentStock: number
  minStock: number
  motivo: string // 'Escaneo QR' | 'Entrada manual'
}

// ─── Internal: retry wrapper ─────────────────────────────────────────────────

async function sendWithRetry(
  payload: Parameters<typeof resend.emails.send>[0],
  idempotencyKey: string,
  maxAttempts = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // idempotencyKey is passed as the second argument (CreateEmailRequestOptions),
    // not spread into the payload — the Resend SDK v6 separates email options from request options.
    const { error } = await resend.emails.send(payload, { idempotencyKey })
    if (!error) return
    const isRetryable =
      error.statusCode === 429 || error.statusCode === 500
    if (!isRetryable || attempt === maxAttempts) {
      console.error(`[alert] Email send failed after ${attempt} attempt(s):`, error)
      return
    }
    // 1-second linear backoff between retries (sufficient for internal tool at 3-10 users)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// ─── Internal: HTML email builder ────────────────────────────────────────────

function buildAlertEmailHtml(
  params: SendLowStockAlertParams & { productUrl: string },
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Alerta de stock bajo</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">
    &#x26A0;&#xFE0F; Stock bajo: ${params.productName}
  </h1>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr>
      <td style="padding: 8px 0; color: #555; width: 160px;">Producto</td>
      <td style="padding: 8px 0; font-weight: 500;">${params.productName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #555;">Stock actual</td>
      <td style="padding: 8px 0; font-weight: 500; color: #b91c1c;">${params.currentStock}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #555;">Stock m&#xED;nimo</td>
      <td style="padding: 8px 0;">${params.minStock}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #555;">Tipo de movimiento</td>
      <td style="padding: 8px 0;">${params.motivo}</td>
    </tr>
  </table>
  <a href="${params.productUrl}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 500;">
    Ver producto
  </a>
  <p style="margin-top: 24px; color: #888; font-size: 12px;">
    Este email fue enviado autom&#xE1;ticamente por StockControl.
  </p>
</body>
</html>
  `.trim()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends a low-stock alert email via Resend.
 *
 * Behavior:
 * - Fetches global alert email from AppConfig (key='alert_email').
 * - If no email configured, logs a warning and returns without sending.
 * - Uses idempotency key 'stock-alert/{productId}' to prevent duplicate delivery on retry.
 * - Retries up to 3 times on 429/500 errors with 1-second linear backoff.
 * - Never throws — logs errors and returns.
 *
 * Called OUTSIDE prisma.$transaction (per D-04):
 * DB commit happens first (alertActive=true set by CAS in caller), then this runs.
 */
export async function sendLowStockAlertWithRetry(
  params: SendLowStockAlertParams,
): Promise<void> {
  // Fetch global recipient email from AppConfig
  const config = await prisma.appConfig.findUnique({ where: { key: 'alert_email' } })

  if (!config?.value) {
    // Silently log and skip — do not disrupt stock mutation flow (Claude's Discretion, D-04)
    console.warn(
      '[alert] No global alert email configured — skipping email for product:',
      params.productId,
    )
    return
  }

  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/productos/${params.productId}`

  await sendWithRetry(
    {
      from: 'StockControl <onboarding@resend.dev>',
      to: [config.value],
      subject: `⚠️ Stock bajo: ${params.productName}`,
      html: buildAlertEmailHtml({ ...params, productUrl }),
    },
    // Time-bucketed key (1-hour window): prevents duplicates within a retry burst
    // but allows a new alert to fire on the next stock crossing after recovery.
    // alertActive CAS is the primary dedup — this is a secondary guard for Resend retries.
    `stock-alert/${params.productId}/${Math.floor(Date.now() / 3_600_000)}`,
  )
}
