import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendLowStockAlertWithRetry } from '@/lib/email'

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

const BodySchema = z.object({
  productId: z.string().uuid(),
  cantidad: z.number().int().positive(),
  motivo: z.string().optional(),
})

async function getOrCreateSystemUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { username: 'ml-ventas' },
    update: {},
    create: {
      username: 'ml-ventas',
      // Not a valid bcrypt hash — this account cannot log in
      passwordHash: '$system$no-login',
      role: 'OPERADOR',
    },
    select: { id: true },
  })
  return user.id
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { productId, cantidad, motivo = 'Empaquetado ML Ventas' } = parsed.data
  const delta = -cantidad

  const systemUserId = await getOrCreateSystemUser()

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
        select: { stock: true },
      })

      if (updated.stock < 0) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      await tx.movement.create({
        data: { productId, userId: systemUserId, delta, motivo },
      })
    })

    // Alert logic — same CAS pattern as subtractStockViaQR
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { nombre: true, minStock: true, alertActive: true, stock: true },
    })

    if (product && product.stock < product.minStock) {
      const result = await prisma.product.updateMany({
        where: { id: productId, alertActive: false },
        data: { alertActive: true },
      })
      if (result.count === 1) {
        await sendLowStockAlertWithRetry({
          productId,
          productName: product.nombre,
          currentStock: product.stock,
          minStock: product.minStock,
          motivo,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'INSUFFICIENT_STOCK' }, { status: 422 })
    }
    console.error('[internal/reduce-stock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
