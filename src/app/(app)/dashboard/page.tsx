import { getAuthenticatedUser } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from '@/components/dashboard-client'

export default async function DashboardPage() {
  const session = await getAuthenticatedUser()

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { ocultarEnDashboard: false },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.category.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Dashboard</h1>
      <DashboardClient
        products={products}
        categories={categories}
        userRole={session.role}
      />
    </div>
  )
}
