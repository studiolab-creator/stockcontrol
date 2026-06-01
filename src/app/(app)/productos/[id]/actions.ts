'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/dal'
import { sendLowStockAlertWithRetry } from '@/lib/email'

const MovementSchema = z.object({
  productId: z.string().uuid(),
  delta: z.coerce.number().refine((n) => n !== 0, { message: 'La cantidad debe ser distinta de cero.' }),
  motivo: z.string().max(500).optional().nullable(),
})

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export async function addStockMovement(
  productId: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // T-02: unauthenticated mutation — always first line
  const session = await getAuthenticatedUser()

  const rawDelta = Number(formData.get('delta'))

  // T-01: Operador role enforcement — server-side only; client toggle is cosmetic
  if (session.role === 'OPERADOR' && rawDelta <= 0) {
    return { error: 'Los operadores solo pueden agregar stock.' }
  }

  // T-03: Zod validates all inputs — Prisma parameterizes all DB values
  const validated = MovementSchema.safeParse({
    productId,
    delta: rawDelta,
    motivo: formData.get('motivo') || null,
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { delta, motivo } = validated.data

  try {
    await prisma.$transaction(async (tx) => {
      // CRITICAL: { increment: delta } compiles to single atomic SQL:
      // UPDATE "Product" SET stock = stock + $delta WHERE id = $productId
      // This is NOT a read-then-write — it prevents concurrent lost updates.
      // Per CLAUDE.md constraint: never read-then-write stock.
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
        select: { stock: true },
      })

      // Check AFTER update — new value is already in transaction.
      // If negative, throw to trigger automatic ROLLBACK.
      if (updated.stock < 0) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      // Append-only: NEVER update or delete Movement rows (CLAUDE.md ledger constraint)
      await tx.movement.create({
        data: {
          productId,
          userId: session.userId,
          delta,
          motivo,
        },
      })
    })

    // ── Phase 4: alertActive post-commit logic (D-01, D-02, D-03, D-04) ─────────
    // Runs OUTSIDE the transaction — stock is already committed at this point.
    // Single indexed PK read for minStock, alertActive, and confirmed post-commit stock.
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { nombre: true, minStock: true, alertActive: true, stock: true },
    })

    if (product) {
      if (delta < 0 && product.stock < product.minStock) {
        // Branch A: manual reduction crossed alert threshold
        // D-02: strict less-than (stock < minStock, NOT <=)
        // CAS handles dedup atomically — no pre-check needed (mirrors QR path)
        const result = await prisma.product.updateMany({
          where: { id: productId, alertActive: false },
          data: { alertActive: true },
        })
        if (result.count === 1) {
          // This caller won the CAS — send the alert email
          await sendLowStockAlertWithRetry({
            productId,
            productName: product.nombre,
            currentStock: product.stock,
            minStock: product.minStock,
            motivo: 'Entrada manual',
          })
        }
      } else if (delta > 0 && product.stock >= product.minStock && product.alertActive) {
        // Branch B: stock recovered to or above minStock — reset flag so next crossing fires a new alert
        // D-03 corrected: reset when stock >= minStock to prevent stuck alertActive at stock == minStock
        // Plain update (no CAS needed — stock recovery is not a concurrent-race scenario)
        await prisma.product.update({
          where: { id: productId },
          data: { alertActive: false },
        })
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // Revalidate all three views that display stock or movement data
    revalidatePath('/dashboard')
    revalidatePath(`/productos/${productId}`)
    revalidatePath('/historial')
    revalidatePath('/alertas')
    return undefined // success — triggers dialog close in useActionState

  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
      return { error: 'No se pudo aplicar el movimiento. Verificá el stock actual.' }
    }
    return { error: 'Ocurrió un error. Intentá de nuevo.' }
  }
}
