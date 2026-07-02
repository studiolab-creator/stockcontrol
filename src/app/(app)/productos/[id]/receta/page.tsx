import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/dal'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RecetaForm } from './receta-form'
import { upsertRecetaItem, deleteRecetaItem } from './actions'

export default async function RecetaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [product, recetaItems, todosLosIngredientes] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: { id: true, nombre: true, tipo: true },
    }),
    prisma.recetaItem.findMany({
      where: { productoId: id },
      include: { insumo: { select: { id: true, nombre: true, unidad: true, tipo: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.product.findMany({
      select: { id: true, nombre: true, unidad: true, tipo: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  if (!product || product.tipo !== 'TERMINADO') {
    notFound()
  }

  const ingredienteIdsEnReceta = new Set(recetaItems.map((r) => r.insumoId))
  const ingredientesDisponibles = todosLosIngredientes.filter((i) => !ingredienteIdsEnReceta.has(i.id))

  const boundAction = upsertRecetaItem.bind(null, id)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Receta — {product.nombre}</h1>
        <Button variant="ghost" size="sm" render={<Link href={`/productos/${id}`} />}>
          ← Volver al producto
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Definí cuánto de cada insumo o producto se consume por unidad de este producto.
      </p>

      {recetaItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">
          Este producto no tiene receta configurada todavía.
        </p>
      ) : (
        <Table className="mb-6">
          <TableHeader>
            <TableRow>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Cantidad por unidad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recetaItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">
                  {item.insumo.nombre}
                  {item.insumo.tipo === 'TERMINADO' && (
                    <span className="ml-2 text-xs text-muted-foreground">(producto)</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {item.cantidad}{item.insumo.unidad ? ` ${item.insumo.unidad}` : ''}
                </TableCell>
                <TableCell className="text-right">
                  <form
                    action={async () => {
                      'use server'
                      await deleteRecetaItem(id, item.insumoId)
                    }}
                  >
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      Eliminar
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Separator className="my-6" />

      <h2 className="text-base font-semibold mb-4">Agregar ingrediente</h2>
      <RecetaForm action={boundAction} ingredientesDisponibles={ingredientesDisponibles} />
    </div>
  )
}
