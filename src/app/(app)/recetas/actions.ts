'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

const NuevoProductoRecetaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.').max(200),
  sku: z.string().max(100).optional().nullable(),
  unidad: z.string().max(50).optional().nullable(),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export async function crearProductoParaReceta(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = NuevoProductoRecetaSchema.safeParse({
    nombre: formData.get('nombre'),
    sku: formData.get('sku') || null,
    unidad: formData.get('unidad') || null,
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const product = await prisma.product.create({
    data: {
      ...validated.data,
      tipo: 'TERMINADO',
      minStock: 0,
      ocultarEnDashboard: true,
    },
  })

  redirect(`/productos/${product.id}/receta`)
}
