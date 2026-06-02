import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'
import { NuevoPedidoClient, type Recetas } from './nuevo-pedido-client'

export default async function NuevoPedidoPage() {
  await requireAdmin()

  const [terminados, recetaItems] = await Promise.all([
    prisma.product.findMany({
      where: { tipo: 'TERMINADO' },
      select: { id: true, nombre: true, unidad: true, stock: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.recetaItem.findMany({
      include: {
        insumo: { select: { id: true, nombre: true, unidad: true, stock: true } },
      },
    }),
  ])

  const recetas: Recetas = {}
  for (const item of recetaItems) {
    if (!recetas[item.productoId]) recetas[item.productoId] = []
    recetas[item.productoId].push({
      insumoId: item.insumoId,
      insumoNombre: item.insumo.nombre,
      insumoUnidad: item.insumo.unidad,
      insumoStock: item.insumo.stock,
      cantidad: item.cantidad,
    })
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Nuevo pedido</h1>
      <NuevoPedidoClient terminados={terminados} recetas={recetas} />
    </div>
  )
}
