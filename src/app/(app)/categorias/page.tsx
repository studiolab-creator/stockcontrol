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
import { CategoryDialog } from '@/components/category-dialog'
import { createCategory, updateCategory } from './actions'

export default async function CategoriasPage() {
  // Admin-only page — redirects non-admin to /dashboard
  await requireAdmin()

  const categories = await prisma.category.findMany({
    orderBy: { nombre: 'asc' },
  })

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Categorías</h1>
        {/* Create dialog — opens empty form */}
        <CategoryDialog action={createCategory} mode="create" />
      </div>

      {categories.length === 0 ? (
        /* Empty state per UI-SPEC */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin categorías</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Creá categorías para organizar tus productos.
          </p>
          <CategoryDialog action={createCategory} mode="create" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-[100px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => {
              // Bind category.id into updateCategory for this row
              const boundUpdate = updateCategory.bind(null, category.id)
              return (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.nombre}</TableCell>
                  <TableCell className="text-right">
                    <CategoryDialog
                      action={boundUpdate}
                      mode="edit"
                      defaultValues={{ nombre: category.nombre }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
