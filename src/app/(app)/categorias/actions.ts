'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

const CategorySchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.').max(100),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export async function createCategory(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Auth check — ADMIN only. Redirects to /dashboard for non-admins.
  await requireAdmin()

  const validated = CategorySchema.safeParse({
    nombre: formData.get('nombre'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // Duplicate check before insert
  const existing = await prisma.category.findUnique({
    where: { nombre: validated.data.nombre },
  })
  if (existing) {
    return { error: 'Este nombre de categoría ya está en uso.' }
  }

  try {
    await prisma.category.create({
      data: { nombre: validated.data.nombre },
    })
    revalidatePath('/categorias')
    // Return undefined on success — the dialog handles closing and toast
    return undefined
  } catch {
    return { error: 'No se pudo guardar la categoría. Intentá de nuevo.' }
  }
}

export async function updateCategory(
  id: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Auth check — ADMIN only.
  await requireAdmin()

  const validated = CategorySchema.safeParse({
    nombre: formData.get('nombre'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // Duplicate check — exclude the current category being updated
  const existing = await prisma.category.findFirst({
    where: {
      nombre: validated.data.nombre,
      NOT: { id },
    },
  })
  if (existing) {
    return { error: 'Este nombre de categoría ya está en uso.' }
  }

  try {
    await prisma.category.update({
      where: { id },
      data: { nombre: validated.data.nombre },
    })
    revalidatePath('/categorias')
    return undefined
  } catch {
    return { error: 'No se pudo guardar la categoría. Intentá de nuevo.' }
  }
}
