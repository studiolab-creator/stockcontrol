'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

const RecetaItemSchema = z.object({
  insumoId: z.string().uuid(),
  cantidad: z.coerce.number().positive(),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export async function upsertRecetaItem(
  productoId: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = RecetaItemSchema.safeParse({
    insumoId: formData.get('insumoId'),
    cantidad: formData.get('cantidad'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { insumoId, cantidad } = validated.data

  if (insumoId === productoId) {
    return { error: 'Un producto no puede ser insumo de sí mismo.' }
  }

  await prisma.recetaItem.upsert({
    where: { productoId_insumoId: { productoId, insumoId } },
    create: { productoId, insumoId, cantidad },
    update: { cantidad },
  })

  revalidatePath(`/productos/${productoId}/receta`)
  return undefined
}

export async function deleteRecetaItem(productoId: string, insumoId: string) {
  await requireAdmin()

  await prisma.recetaItem.delete({
    where: { productoId_insumoId: { productoId, insumoId } },
  })

  revalidatePath(`/productos/${productoId}/receta`)
}
