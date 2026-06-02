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

  // Load recipes for all TERMINADO products in this order
  const productIds = items.map((i) => i.productoId)
  const recetaItems = await prisma.recetaItem.findMany({
    where: { productoId: { in: productIds } },
    select: { productoId: true, insumoId: true, cantidad: true },
  })

  // Aggregate total deduction per insumo
  // Products without recipe items simply don't deduct any insumo stock.
  const insumoTotales = new Map<string, number>()
  for (const item of items) {
    for (const r of recetaItems.filter((r) => r.productoId === item.productoId)) {
      insumoTotales.set(r.insumoId, (insumoTotales.get(r.insumoId) ?? 0) + r.cantidad * item.cantidad)
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

      for (const [insumoId, total] of insumoTotales) {
        const updated = await tx.product.update({
          where: { id: insumoId },
          data: { stock: { increment: -total } },
          select: { stock: true },
        })

        if (updated.stock < 0) {
          throw new Error(`INSUFFICIENT_STOCK:${insumoId}`)
        }

        await tx.movement.create({
          data: { productId: insumoId, userId: session.userId, delta: -total, motivo },
        })
      }
    })

    // Alert logic — outside transaction, same CAS pattern as the rest of the app
    for (const [insumoId] of insumoTotales) {
      const product = await prisma.product.findUnique({
        where: { id: insumoId },
        select: { nombre: true, minStock: true, alertActive: true, stock: true },
      })
      if (product && product.stock < product.minStock) {
        const result = await prisma.product.updateMany({
          where: { id: insumoId, alertActive: false },
          data: { alertActive: true },
        })
        if (result.count === 1) {
          await sendLowStockAlertWithRetry({
            productId: insumoId,
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
      const insumoId = err.message.split(':')[1]
      const insumo = await prisma.product.findUnique({
        where: { id: insumoId },
        select: { nombre: true },
      })
      return { error: `Stock insuficiente de "${insumo?.nombre ?? 'insumo desconocido'}".` }
    }
    console.error('[crearPedido]', err)
    return { error: 'Ocurrió un error. Intentá de nuevo.' }
  }
}
