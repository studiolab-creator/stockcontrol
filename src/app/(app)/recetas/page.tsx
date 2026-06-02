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
import { Badge } from '@/components/ui/badge'

export default async function RecetasPage() {
  await requireAdmin()

  const terminados = await prisma.product.findMany({
    where: { tipo: 'TERMINADO' },
    include: {
      _count: { select: { recetaItems: true } },
    },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recetas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Definí qué insumos consume cada producto terminado por unidad producida.
          </p>
        </div>
      </div>

      {terminados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin productos terminados</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Creá al menos un producto de tipo &quot;Terminado&quot; para configurar su receta.
          </p>
          <Button variant="outline" render={<Link href="/productos/nuevo" />}>
            Nuevo producto
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Insumos en receta</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {terminados.map((producto) => (
              <TableRow key={producto.id} className="hover:bg-muted/50">
                <TableCell className="text-sm font-medium">{producto.nombre}</TableCell>
                <TableCell>
                  {producto._count.recetaItems === 0 ? (
                    <Badge variant="destructive" className="text-xs">Sin receta</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {producto._count.recetaItems} insumo{producto._count.recetaItems !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/productos/${producto.id}/receta`} />}
                  >
                    {producto._count.recetaItems === 0 ? 'Configurar receta' : 'Editar receta'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
