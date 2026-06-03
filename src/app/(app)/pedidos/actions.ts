'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

export async function eliminarPedido(pedidoId: string): Promise<{ error?: string; success?: true }> {
  const session = await requireAdmin()

  // Load pedido with items and their recipes
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      items: { select: { productoId: true, cantidad: true } },
    },
  })

  if (!pedido) return { error: 'Pedido no encontrado.' }

  const productIds = pedido.items.map((i) => i.productoId)

  const recetaItems = await prisma.recetaItem.findMany({
    where: { productoId: { in: productIds } },
    select: { productoId: true, insumoId: true, cantidad: true },
  })

  const productosConReceta = new Set(recetaItems.map((r) => r.productoId))

  // Aggregate restorations — same logic as crearPedido but signs are positive
  const stockRestores = new Map<string, number>()
  for (const item of pedido.items) {
    if (productosConReceta.has(item.productoId)) {
      for (const r of recetaItems.filter((r) => r.productoId === item.productoId)) {
        stockRestores.set(r.insumoId, (stockRestores.get(r.insumoId) ?? 0) + r.cantidad * item.cantidad)
      }
    } else {
      stockRestores.set(item.productoId, (stockRestores.get(item.productoId) ?? 0) + item.cantidad)
    }
  }

  const motivo = pedido.descripcion
    ? `Anulación pedido: ${pedido.descripcion}`
    : 'Anulación de pedido'

  try {
    await prisma.$transaction(async (tx) => {
      // Restore stock and create reversal movements
      for (const [productId, total] of stockRestores) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: total } },
        })
        await tx.movement.create({
          data: { productId, userId: session.userId, delta: total, motivo },
        })
      }

      // Delete pedido — cascade removes PedidoItems
      await tx.pedido.delete({ where: { id: pedidoId } })
    })

    // Reset alertActive for any product whose stock recovered above minStock
    for (const [productId] of stockRestores) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { stock: true, minStock: true, alertActive: true },
      })
      if (product && product.stock >= product.minStock && product.alertActive) {
        await prisma.product.update({
          where: { id: productId },
          data: { alertActive: false },
        })
      }
    }

    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    revalidatePath('/historial')
    return { success: true }
  } catch (err) {
    console.error('[eliminarPedido]', err)
    return { error: 'No se pudo anular el pedido. Intentá de nuevo.' }
  }
}
