import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAuthenticatedUser } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StockMovementDialog } from '@/components/stock-movement-dialog'
import { addStockMovement } from './actions'

// Created once outside the component to avoid re-instantiation on every render.
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Auth guard — redirects to /login if no valid session
  const session = await getAuthenticatedUser()

  // MUST await both — params and searchParams are Promises in Next.js 16 (RESEARCH.md Pitfall 3)
  const { id } = await params
  const sp = await searchParams

  const fromStr = sp.from as string | undefined
  const toStr = sp.to as string | undefined
  const userId = sp.userId as string | undefined

  const from = fromStr ? new Date(fromStr) : undefined
  const to = toStr ? new Date(toStr) : undefined

  const [product, movements, users] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { categoria: true },
    }),
    prisma.movement.findMany({
      where: {
        productId: id,
        ...(from || to
          ? {
              createdAt: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
        ...(userId && userId !== '__all__' ? { userId } : {}),
      },
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    }),
  ])

  if (!product) {
    notFound()
  }

  const boundAction = addStockMovement.bind(null, product.id)
  const isLowStock = product.stock <= product.minStock
  const unit = product.unidad ? ` ${product.unidad}` : ''

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-xl font-semibold text-foreground">{product.nombre}</h1>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/productos/${product.id}/editar`} />}
        >
          Editar producto
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant={product.tipo === 'TERMINADO' ? 'default' : 'secondary'}>
          {product.tipo === 'TERMINADO' ? 'Terminado' : 'Insumo'}
        </Badge>
        {product.categoria && (
          <span className="text-sm text-muted-foreground">{product.categoria.nombre}</span>
        )}
      </div>

      <div className="flex items-center gap-6 mb-4 text-sm">
        <p className="text-foreground">
          Stock actual:{' '}
          <span className="font-medium">
            {product.stock}{unit}
          </span>
        </p>
        <p className="text-muted-foreground">
          Mínimo: {product.minStock}{unit}
        </p>
      </div>

      <div className="mb-6">
        <StockMovementDialog
          product={product}
          action={boundAction}
          userRole={session.role}
          isLowStock={isLowStock}
        />
      </div>

      <Separator className="my-6" />

      <h2 className="text-base font-semibold mb-4">Historial de movimientos</h2>

      <form
        method="GET"
        action={`/productos/${product.id}`}
        className="flex flex-wrap gap-4 mb-6"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-muted-foreground">
            Desde
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={fromStr}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-muted-foreground">
            Hasta
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={toStr}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="userId" className="text-xs text-muted-foreground">
            Usuario
          </label>
          <Select name="userId" defaultValue={userId ?? '__all__'}>
            <SelectTrigger id="userId" className="w-[160px]">
              <SelectValue placeholder="Todos los usuarios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los usuarios</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" size="sm">
            Filtrar
          </Button>
        </div>
      </form>

      {movements.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay movimientos registrados para este producto.
        </p>
      )}

      {movements.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/50">
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {dateFormatter.format(new Date(m.createdAt))}
                </TableCell>
                <TableCell className="text-sm">
                  {m.user.username}
                </TableCell>
                <TableCell
                  className={`text-sm font-medium ${
                    m.delta > 0 ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : `${m.delta}`}{unit}
                </TableCell>
                <TableCell
                  className="text-sm text-muted-foreground max-w-[200px]"
                  title={m.motivo ?? undefined}
                >
                  {m.motivo
                    ? m.motivo.length > 40
                      ? `${m.motivo.slice(0, 40)}…`
                      : m.motivo
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
