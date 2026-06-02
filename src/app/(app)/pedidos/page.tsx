import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Productos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((pedido) => (
              <TableRow key={pedido.id} className="hover:bg-muted/50 align-top">
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {dateFormatter.format(new Date(pedido.createdAt))}
                </TableCell>
                <TableCell className="text-sm">{pedido.user.username}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {pedido.descripcion ?? '—'}
                </TableCell>
                <TableCell className="text-sm">
                  <ul className="flex flex-col gap-0.5">
                    {pedido.items.map((item) => {
                      const unit = item.producto.unidad ? ` ${item.producto.unidad}` : ''
                      return (
                        <li key={item.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{item.producto.nombre}</span>
                          {' '}× {item.cantidad}{unit}
                        </li>
                      )
                    })}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
