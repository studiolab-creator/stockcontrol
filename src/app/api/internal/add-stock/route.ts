import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

const BodySchema = z.object({
  sku: z.string().min(1),
  cantidad: z.number().positive(),
  motivo: z.string().optional(),
})

async function getOrCreateSystemUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { username: 'ml-ventas' },
    update: {},
    create: {
      username: 'ml-ventas',
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

  const { sku, cantidad, motivo = 'Desempaquetado ML Ventas' } = parsed.data
  const delta = cantidad

  const product = await prisma.product.findFirst({
    where: { sku },
    select: { id: true, nombre: true, minStock: true, alertActive: true, stock: true },
  })
  if (!product) {
    return NextResponse.json({ error: `Producto con SKU "${sku}" no encontrado.` }, { status: 404 })
  }

  const systemUserId = await getOrCreateSystemUser()

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { stock: { increment: delta } },
    })
    await tx.movement.create({
      data: { productId: product.id, userId: systemUserId, delta, motivo },
    })
  })

  // Reset alertActive if stock recovers above minStock
  const updated = await prisma.product.findUnique({
    where: { id: product.id },
    select: { stock: true, minStock: true, alertActive: true },
  })
  if (updated && updated.stock >= updated.minStock && updated.alertActive) {
    await prisma.product.updateMany({
      where: { id: product.id, alertActive: true },
      data: { alertActive: false },
    })
  }

  return NextResponse.json({ success: true })
}
