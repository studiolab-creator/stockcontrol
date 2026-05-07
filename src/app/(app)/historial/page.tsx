import Link from 'next/link'
import { getAuthenticatedUser } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
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

const PAGE_SIZE = 50

// Created once outside the component to avoid re-instantiation on every render.
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await getAuthenticatedUser()

  // MUST await — searchParams is a Promise in Next.js 16
  const sp = await searchParams

  const page = Math.max(1, Number(sp.page) || 1)
  const fromStr = sp.from as string | undefined
  const toStr = sp.to as string | undefined
  const userId = sp.userId as string | undefined

  const from = fromStr ? new Date(fromStr) : undefined
  const to = toStr ? new Date(toStr) : undefined

  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(from || to
      ? {
          createdAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        }
      : {}),
    ...(userId && userId !== '__all__' ? { userId } : {}),
  }

  const [movements, total, users] = await Promise.all([
    prisma.movement.findMany({
      where,
      include: {
        product: { select: { id: true, nombre: true, unidad: true } },
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.movement.count({ where }),
    prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = !!(fromStr || toStr || (userId && userId !== '__all__'))

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams()
    params.set('page', String(targetPage))
    if (fromStr) params.set('from', fromStr)
    if (toStr) params.set('to', toStr)
    if (userId && userId !== '__all__') params.set('userId', userId)
    return `/historial?${params.toString()}`
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Historial global</h1>

      <form
        method="GET"
        action="/historial"
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

      {total === 0 && !hasFilters && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin movimientos</h2>
          <p className="text-sm text-muted-foreground">
            Los movimientos de stock aparecerán aquí a medida que se registren entradas y salidas.
          </p>
        </div>
      )}

      {total === 0 && hasFilters && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin resultados</h2>
          <p className="text-sm text-muted-foreground mb-4">
            No se encontraron movimientos con los filtros aplicados.
          </p>
          <Button variant="ghost" render={<Link href="/historial" />}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {total > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Mostrando {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total} movimientos
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => {
                const unit = m.product.unidad ? ` ${m.product.unidad}` : ''
                return (
                  <TableRow key={m.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {dateFormatter.format(new Date(m.createdAt))}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/productos/${m.product.id}`}
                        className="underline underline-offset-2 hover:text-primary"
                      >
                        {m.product.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.user.username}
                    </TableCell>
                    <TableCell
                      className={`text-sm font-medium ${
                        m.delta > 0 ? 'text-emerald-600' : 'text-destructive'
                      }`}
                    >
                      {m.delta > 0 ? `+${m.delta}` : String(m.delta)}{unit}
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
                )
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              render={<Link href={buildHref(page - 1)} />}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              render={<Link href={buildHref(page + 1)} />}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
