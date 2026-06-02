'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'
import { sendLowStockAlertWithRetry } from '@/lib/email'

const PedidoSchema = z.object({
  descripcion: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.number().positive(),
      }),
    )
    .min(1),
})

export async function crearPedido(input: unknown): Promise<{ error?: string; success?: true }> {
  const session = await requireAdmin()

  const validated = PedidoSchema.safeParse(input)
  if (!validated.success) {
    return { error: 'Datos inválidos.' }
  }

  const { descripcion, items } = validated.data

  const productIds = items.map((i) => i.productoId)
  const recetaItems = await prisma.recetaItem.findMany({
    where: { productoId: { in: productIds } },
    select: { productoId: true, insumoId: true, cantidad: true },
  })

  // Build a set of products that have at least one recipe entry
  const productosConReceta = new Set(recetaItems.map((r) => r.productoId))

  // Aggregate deductions:
  // - Products WITH recipe → deduct their insumos
  // - Products WITHOUT recipe → deduct the product itself directly
  const stockDeductions = new Map<string, number>()

  for (const item of items) {
    if (productosConReceta.has(item.productoId)) {
      for (const r of recetaItems.filter((r) => r.productoId === item.productoId)) {
        stockDeductions.set(r.insumoId, (stockDeductions.get(r.insumoId) ?? 0) + r.cantidad * item.cantidad)
      }
    } else {
      // No recipe — deduct from the product's own stock
      stockDeductions.set(item.productoId, (stockDeductions.get(item.productoId) ?? 0) + item.cantidad)
    }
  }

  const motivo = descripcion ? `Pedido: ${descripcion}` : 'Pedido manual'

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pedido.create({
        data: {
          userId: session.userId,
          descripcion: descripcion ?? null,
          items: {
            create: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
          },
        },
      })

      for (const [productId, total] of stockDeductions) {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: -total } },
          select: { stock: true },
        })

        if (updated.stock < 0) {
          throw new Error(`INSUFFICIENT_STOCK:${productId}`)
        }

        await tx.movement.create({
          data: { productId, userId: session.userId, delta: -total, motivo },
        })
      }
    })

    // Alert logic — outside transaction, same CAS pattern as the rest of the app
    for (const [productId] of stockDeductions) {
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
    }

    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    revalidatePath('/historial')
    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('INSUFFICIENT_STOCK:')) {
      const failedId = err.message.split(':')[1]
      const product = await prisma.product.findUnique({
        where: { id: failedId },
        select: { nombre: true },
      })
      return { error: `Stock insuficiente de "${product?.nombre ?? 'producto desconocido'}".` }
    }
    console.error('[crearPedido]', err)
    return { error: 'Ocurrió un error. Intentá de nuevo.' }
  }
}
