import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/product-form'
import { updateProduct } from '../../actions'

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()

  const { id } = await params

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ])

  if (!product) {
    notFound()
  }

  // Bind product id into updateProduct for this page
  const boundUpdate = updateProduct.bind(null, product.id)

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Editar producto</h1>
      <ProductForm
        action={boundUpdate}
        categories={categories}
        mode="edit"
        defaultValues={{
          nombre: product.nombre,
          descripcion: product.descripcion,
          tipo: product.tipo,
          categoriaId: product.categoriaId,
          sku: product.sku,
          unidad: product.unidad,
          minStock: product.minStock,
        }}
      />
    </div>
  )
}
