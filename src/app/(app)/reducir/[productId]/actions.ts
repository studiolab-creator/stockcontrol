'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/dal'
import { sendLowStockAlertWithRetry } from '@/lib/email'

const ReduceSchema = z.object({
  productId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
})

type ActionState =
  | { error?: string; errors?: Record<string, string[]>; success?: true }
  | undefined

export async function subtractStockViaQR(
  productId: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // T-02: auth always first — any authenticated user (ADMIN or OPERADOR) can reduce via QR
  const session = await getAuthenticatedUser()

  const validated = ReduceSchema.safeParse({
    productId,
    cantidad: formData.get('cantidad'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { cantidad } = validated.data
  // QR scan is always a stock REDUCTION — delta is forced negative (CLAUDE.md constraint)
  const delta = -cantidad

  try {
    await prisma.$transaction(async (tx) => {
      // CRITICAL: { increment: delta } compiles to atomic SQL:
      //   UPDATE "Product" SET stock = stock + $delta WHERE id = $productId
      // delta is negative, so this is a subtraction.
      // This is NOT a read-then-write — it prevents concurrent lost updates.
      // CLAUDE.md constraint: "Atomic SQL ... NEVER read-then-write."
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
        select: { stock: true },
      })

      // Floor check: if new stock < 0, throw to trigger automatic ROLLBACK.
      // Concurrent scans that would produce negative stock are rejected here.
      // STOCK-02: concurrent QR scans cannot produce negative stock.
      if (updated.stock < 0) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      // Append-only ledger — NEVER UPDATE or DELETE movement rows (CLAUDE.md constraint).
      // motivo is hardcoded to 'Escaneo QR' — cannot be overridden by form input.
      await tx.movement.create({
        data: {
          productId,
          userId: session.userId,
          delta,
          motivo: 'Escaneo QR',
        },
      })
    })

    // ── Phase 4: alertActive post-commit logic (D-01, D-02, D-04) ──────────────
    // Runs OUTSIDE the transaction — stock is already committed at this point.
    // Single indexed PK read to get minStock, alertActive, and confirmed stock.
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { nombre: true, minStock: true, alertActive: true, stock: true },
    })

    if (product && product.stock < product.minStock) {
      // D-02: strict threshold — stock < minStock (NOT <=)
      // CAS: updateMany WHERE alertActive=false — at most one concurrent caller gets count=1
      // Prevents duplicate alerts when two QR scans happen simultaneously (RESEARCH Pitfall 1)
      const result = await prisma.product.updateMany({
        where: { id: productId, alertActive: false },
        data: { alertActive: true },
      })
      if (result.count === 1) {
        // This caller won the CAS — send the alert email
        // D-04: email sent after DB commit; if Resend fails, alertActive=true prevents resend
        await sendLowStockAlertWithRetry({
          productId,
          productName: product.nombre,
          currentStock: product.stock,
          minStock: product.minStock,
          motivo: 'Escaneo QR',
        })
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // Revalidate all views that display stock or movement data
    revalidatePath('/dashboard')
    revalidatePath(`/productos/${productId}`)
    revalidatePath('/historial')
    revalidatePath('/alertas')
    // Return success marker — page Client Component checks state?.success to show confirmation
    return { success: true }

  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
      return { error: 'Stock insuficiente para aplicar la reducción.' }
    }
    return { error: 'Ocurrió un error. Intentá de nuevo.' }
  }
}
