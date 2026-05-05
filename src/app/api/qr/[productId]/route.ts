import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  // CRITICAL: requireAdmin() calls redirect() internally — must be BEFORE any try/catch.
  // If wrapped in try/catch, the redirect is swallowed and unauthenticated callers get 200.
  // (RESEARCH.md Pitfall 2 / CLAUDE.md architecture constraint)
  await requireAdmin()

  // params is a Promise in Next.js 16 — must be awaited (RESEARCH.md Pitfall 5)
  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) return notFound()

  // QR content: ONLY the immutable UUID — NEVER name, slug, or mutable fields.
  // This is a hard constraint from CLAUDE.md: "Encode only immutable product UUID."
  const dataUrl = await QRCode.toDataURL(product.id, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  })

  // qrcode has NO toBuffer() method — toDataURL() is the correct API.
  // (RESEARCH.md Pitfall 4: many blog posts wrongly claim toBuffer() exists)
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(b64, 'base64')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${product.id}.png"`,
      // UUID never changes — safe to cache indefinitely
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
