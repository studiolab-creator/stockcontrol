import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    select: { id: true, nombre: true, sku: true, tipo: true, stock: true },
    orderBy: { nombre: 'asc' },
  })

  return NextResponse.json(products)
}
