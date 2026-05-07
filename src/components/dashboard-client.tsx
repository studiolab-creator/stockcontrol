'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StockMovementDialog } from '@/components/stock-movement-dialog'
import { addStockMovement } from '@/app/(app)/productos/[id]/actions'

type Category = { id: string; nombre: string }
type Product = {
  id: string
  nombre: string
  tipo: 'TERMINADO' | 'INSUMO'
  stock: number
  minStock: number
  unidad: string | null
  categoriaId: string | null
  categoria: Category | null
}

type DashboardClientProps = {
  products: Product[]
  categories: Category[]
  userRole: 'ADMIN' | 'OPERADOR'
}

export function DashboardClient({ products, categories, userRole }: DashboardClientProps) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !categoryId || p.categoriaId === categoryId
      return matchesSearch && matchesCategory
    })
  }, [products, search, categoryId])

  const isLowStock = (p: Product) => p.stock <= p.minStock

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-base font-semibold text-foreground mb-1">Sin productos</h2>
        <p className="text-sm text-muted-foreground">
          Todavía no hay productos registrados. Un administrador debe crear productos primero.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-4 mb-6">
        <Input
          className="min-w-[200px] flex-1"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v === '__all__' ? '' : (v ?? ''))}>
          <SelectTrigger className="min-w-[180px]">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin resultados</h2>
          <p className="text-sm text-muted-foreground">
            Ningún producto coincide con tu búsqueda. Probá con otro nombre o categoría.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {filtered.map((product) => {
          const low = isLowStock(product)
          const boundAction = addStockMovement.bind(null, product.id)
          return (
            <Card
              key={product.id}
              className={cn(
                'border',
                low ? 'border-destructive' : 'border-border',
              )}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={product.tipo === 'TERMINADO' ? 'default' : 'secondary'}>
                    {product.tipo === 'TERMINADO' ? 'Terminado' : 'Insumo'}
                  </Badge>
                  {low && (
                    <Badge variant="destructive">Stock bajo</Badge>
                  )}
                </div>
                <h2 className="text-base font-semibold text-foreground mt-2">{product.nombre}</h2>
              </CardHeader>

              <CardContent className="px-4 pb-2">
                <p className="text-sm text-foreground">
                  Stock actual:{' '}
                  <span className="font-medium">
                    {product.stock}{product.unidad ? ` ${product.unidad}` : ''}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Mínimo: {product.minStock}{product.unidad ? ` ${product.unidad}` : ''}
                </p>
              </CardContent>

              <CardFooter className="px-4 pb-4 flex flex-col gap-2">
                <StockMovementDialog
                  product={product}
                  action={boundAction}
                  userRole={userRole}
                  isLowStock={low}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  render={<Link href={`/productos/${product.id}`} />}
                >
                  Ver detalle
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </>
  )
}
