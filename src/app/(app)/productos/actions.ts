'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

const ProductSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.').max(200),
  descripcion: z.string().max(500).optional().nullable(),
  tipo: z.enum(['TERMINADO', 'INSUMO'], {
    error: 'Seleccioná un tipo válido.',
  }),
  categoriaId: z.string().uuid().optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  unidad: z.string().max(50).optional().nullable(),
  minStock: z.coerce.number().min(0, 'El stock mínimo debe ser 0 o mayor.'),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

function parseProductForm(formData: FormData) {
  const categoriaId = formData.get('categoriaId')
  return {
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion') || null,
    tipo: formData.get('tipo'),
    categoriaId: categoriaId && categoriaId !== '' ? categoriaId : null,
    sku: formData.get('sku') || null,
    unidad: formData.get('unidad') || null,
    minStock: formData.get('minStock'),
  }
}

export async function createProduct(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = ProductSchema.safeParse(parseProductForm(formData))
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  try {
    await prisma.product.create({ data: validated.data })
    revalidatePath('/productos')
  } catch {
    return { error: 'No se pudo guardar el producto. Intentá de nuevo.' }
  }

  redirect('/productos')
}

export async function updateProduct(
  id: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = ProductSchema.safeParse(parseProductForm(formData))
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  try {
    await prisma.product.update({
      where: { id },
      data: validated.data,
    })
    revalidatePath('/productos')
  } catch {
    return { error: 'No se pudo guardar el producto. Intentá de nuevo.' }
  }

  redirect('/productos')
}
