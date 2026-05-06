import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { AlertasEmailForm } from './alertas-email-form'

export default async function AlertasPage() {
  // D-10: ADMIN only — redirects OPERADOR to /dashboard, unauthenticated to /login
  await requireAdmin()

  const [config, alertedProducts] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: 'alert_email' } }),
    prisma.product.findMany({
      where: { alertActive: true },
      select: { id: true, nombre: true, stock: true, minStock: true, unidad: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const globalEmail = config?.value ?? ''

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Configuración de alertas</h1>

      {/* Section 1: Global alert email config */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-1">Email de notificaciones</h2>
        <p className="text-sm text-muted-foreground mb-4">
          El email al que se enviará notificación cuando el stock de un producto baje del mínimo.
        </p>
        <AlertasEmailForm currentEmail={globalEmail} />
      </section>

      <Separator className="mb-8" />

      {/* Section 2: Products with active alerts */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-4">
          Productos con stock bajo activo
        </h2>
        {alertedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-base font-semibold text-foreground mb-1">Todo en orden</h3>
            <p className="text-sm text-muted-foreground">
              No hay productos con stock bajo actualmente.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Stock actual</TableHead>
                <TableHead>Stock mínimo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.nombre}</TableCell>
                  <TableCell>
                    {product.stock}{product.unidad ? ` ${product.unidad}` : ''}
                  </TableCell>
                  <TableCell>
                    {product.minStock}{product.unidad ? ` ${product.unidad}` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
