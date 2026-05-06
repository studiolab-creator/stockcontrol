'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'

// D-08: Zod .email() validation — rejects non-email values before DB access
const EmailSchema = z.object({
  email: z.string().email('Ingresá un email válido.'),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

// D-10: ADMIN only — requireAdmin() redirects OPERADOR to /dashboard, unauthenticated to /login
// D-07: Saves a single global email in AppConfig (key='alert_email') — not per-product
// T-04-02: requireAdmin() before any validation or DB access
export async function saveGlobalAlertEmail(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const validated = EmailSchema.safeParse({ email: formData.get('email') })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  try {
    await prisma.appConfig.upsert({
      where: { key: 'alert_email' },
      create: { key: 'alert_email', value: validated.data.email },
      update: { value: validated.data.email },
    })
    revalidatePath('/alertas')
    // Return undefined on success — client checks state === undefined after submit for toast
    return undefined
  } catch {
    return { error: 'No se pudo guardar. Intentá de nuevo.' }
  }
}
