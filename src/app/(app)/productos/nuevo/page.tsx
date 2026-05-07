import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/product-form'
import { createProduct } from '../actions'

export default async function NuevoProductoPage() {
  await requireAdmin()

  const categories = await prisma.category.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Nuevo producto</h1>
      <ProductForm action={createProduct} categories={categories} mode="create" />
    </div>
  )
}
