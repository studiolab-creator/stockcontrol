import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { PedidosTable } from './pedidos-table'

export default async function PedidosPage() {
  await requireAdmin()

  const pedidos = await prisma.pedido.findMany({
    include: {
      user: { select: { username: true } },
      items: {
        include: {
          producto: { select: { nombre: true, unidad: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Pedidos</h1>
        <Button render={<Link href="/pedidos/nuevo" />}>Nuevo pedido</Button>
      </div>

      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin pedidos</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Los pedidos manuales registrados aparecerán aquí.
          </p>
          <Button variant="outline" render={<Link href="/pedidos/nuevo" />}>
            Crear primer pedido
          </Button>
        </div>
      ) : (
        <PedidosTable pedidos={pedidos} />
      )}
    </div>
  )
}
