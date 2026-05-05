import { notFound } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { subtractStockViaQR } from './actions'
import { ReducirClient } from './reducir-client'

export default async function ReducirPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  await getAuthenticatedUser()

  // MUST await — params is a Promise in Next.js 16 (RESEARCH.md Pitfall 5)
  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, nombre: true, stock: true, unidad: true },
  })

  if (!product) {
    notFound()
  }

  // Bind productId at render time — Server Action receives it as first arg
  const boundAction = subtractStockViaQR.bind(null, product.id)

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">
        Reducir stock
      </h1>
      <ReducirClient product={product} action={boundAction} />
    </div>
  )
}
