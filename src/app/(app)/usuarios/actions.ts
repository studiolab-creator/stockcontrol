'use server'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

const CreateUserSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es obligatorio.').max(50),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  role: z.enum(['ADMIN', 'OPERADOR']),
})

const UpdateUserSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es obligatorio.').max(50),
  role: z.enum(['ADMIN', 'OPERADOR']),
})

const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  confirmPassword: z.string().min(1),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

const BCRYPT_ROUNDS = 12

export async function createUser(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = CreateUserSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    role: formData.get('role'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // Duplicate username check
  const existing = await prisma.user.findUnique({
    where: { username: validated.data.username },
  })
  if (existing) {
    return { error: 'Este nombre de usuario ya está en uso.' }
  }

  const passwordHash = await bcrypt.hash(validated.data.password, BCRYPT_ROUNDS)

  try {
    await prisma.user.create({
      data: {
        username: validated.data.username,
        passwordHash,
        role: validated.data.role,
      },
    })
    revalidatePath('/usuarios')
    return undefined
  } catch {
    return { error: 'No se pudo guardar el usuario. Intentá de nuevo.' }
  }
}

export async function updateUser(
  id: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = UpdateUserSchema.safeParse({
    username: formData.get('username'),
    role: formData.get('role'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // Duplicate username check — exclude current user
  const existing = await prisma.user.findFirst({
    where: {
      username: validated.data.username,
      NOT: { id },
    },
  })
  if (existing) {
    return { error: 'Este nombre de usuario ya está en uso.' }
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        username: validated.data.username,
        role: validated.data.role,
      },
    })
    revalidatePath('/usuarios')
    return undefined
  } catch {
    return { error: 'No se pudo guardar el usuario. Intentá de nuevo.' }
  }
}

export async function resetPassword(
  userId: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = ResetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  if (validated.data.password !== validated.data.confirmPassword) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const passwordHash = await bcrypt.hash(validated.data.password, BCRYPT_ROUNDS)

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })
    revalidatePath('/usuarios')
    return undefined
  } catch {
    return { error: 'No se pudo restablecer la contraseña. Intentá de nuevo.' }
  }
}
