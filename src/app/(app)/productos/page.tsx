import Link from 'next/link'
import { getAuthenticatedUser } from '@/lib/dal'
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

export default async function ProductosPage() {
  // All authenticated users can view products; only admins see Edit button
  const session = await getAuthenticatedUser()
  const isAdmin = session.role === 'ADMIN'

  const products = await prisma.product.findMany({
    include: { categoria: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Productos</h1>
        {isAdmin && (
          <Button render={<Link href="/productos/nuevo" />}>
            Nuevo producto
          </Button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin productos</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Todavía no hay productos registrados. Creá el primero para comenzar.
          </p>
          {isAdmin && (
            <Button render={<Link href="/productos/nuevo" />}>
              Nuevo producto
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Stock mínimo</TableHead>
              {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.nombre}</TableCell>
                <TableCell className="text-muted-foreground">{product.sku ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={product.tipo === 'TERMINADO' ? 'default' : 'secondary'}>
                    {product.tipo === 'TERMINADO' ? 'Terminado' : 'Insumo'}
                  </Badge>
                </TableCell>
                <TableCell>{product.categoria?.nombre ?? '—'}</TableCell>
                <TableCell>{product.unidad ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{product.stock}{product.unidad ? ` ${product.unidad}` : ''}</span>
                    {product.stock <= product.minStock && (
                      <Badge variant="destructive">Stock bajo</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{product.minStock}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" render={<Link href={`/productos/${product.id}/editar`} />}>
                      Editar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
