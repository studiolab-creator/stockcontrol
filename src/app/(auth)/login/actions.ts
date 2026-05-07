'use server'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'

// Dummy hash for timing-attack prevention when user is not found.
// bcrypt.compare must always run regardless of whether the user exists.
// Without this, response time difference leaks valid usernames.
const DUMMY_HASH = '$2b$12$placeholder.hash.for.timing.safety.only.not.real'

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function loginAction(
  prevState: unknown,
  formData: FormData,
): Promise<{ error: string }> {
  const validated = LoginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  })

  if (!validated.success) {
    return { error: 'Usuario o contraseña incorrectos.' }
  }

  const user = await prisma.user.findUnique({
    where: { username: validated.data.username },
  })

  // Always run bcrypt.compare — even when user is not found.
  // This prevents timing-based username enumeration attacks.
  const passwordMatch = await bcrypt.compare(
    validated.data.password,
    user?.passwordHash ?? DUMMY_HASH,
  )

  if (!user || !passwordMatch) {
    return { error: 'Usuario o contraseña incorrectos.' }
  }

  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  redirect('/dashboard')
}

export async function logoutAction(): Promise<never> {
  await deleteSession()
  redirect('/login')
}
