import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { QrManagementClient } from '@/components/qr-management-client'

export default async function QrPage() {
  // ADMIN only — redirects OPERADOR to /dashboard, unauthenticated to /login
  await requireAdmin()

  // Schema has no `activo` boolean field — all products are treated as active.
  // The PLAN mentioned `activo: true` but the Prisma schema does not have this column.
  const products = await prisma.product.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Gestión QR</h1>
      <QrManagementClient products={products} />
    </div>
  )
}
