'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { crearPedido } from './actions'

export type Terminado = { id: string; nombre: string; unidad: string | null }
export type RecetaEntry = {
  insumoId: string
  insumoNombre: string
  insumoUnidad: string | null
  insumoStock: number
  cantidad: number
}
export type Recetas = Record<string, RecetaEntry[]>

type OrderItem = { productoId: string; cantidad: number }

export function NuevoPedidoClient({
  terminados,
  recetas,
}: {
  terminados: Terminado[]
  recetas: Recetas
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2>(1)
  const [descripcion, setDescripcion] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [selectedProductoId, setSelectedProductoId] = useState('')
  const [cantidad, setCantidad] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const impacto = computeImpacto(items, recetas)

  const handleAddItem = () => {
    const cant = Number(cantidad)
    if (!selectedProductoId || !cant || cant <= 0) return
    setItems((prev) => {
      const existing = prev.find((i) => i.productoId === selectedProductoId)
      if (existing) {
        return prev.map((i) =>
          i.productoId === selectedProductoId ? { ...i, cantidad: i.cantidad + cant } : i,
        )
      }
      return [...prev, { productoId: selectedProductoId, cantidad: cant }]
    })
    setCantidad('')
    setSelectedProductoId('')
  }

  const handleRemoveItem = (productoId: string) => {
    setItems((prev) => prev.filter((i) => i.productoId !== productoId))
  }

  const handleConfirmar = () => {
    setError(null)
    startTransition(async () => {
      const result = await crearPedido({
        descripcion: descripcion || null,
        items,
      })
      if (result?.error) {
        setError(result.error)
        setStep(1)
      } else {
        toast.success('Pedido registrado correctamente')
        router.push('/pedidos')
      }
    })
  }

  const terminadosDisponibles = terminados.filter(
    (t) => !items.some((i) => i.productoId === t.id),
  )

  if (step === 1) {
    return (
      <div className="max-w-xl flex flex-col gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descripcion">Descripción (opcional)</Label>
          <Textarea
            id="descripcion"
            placeholder="Ej: Feria 10 junio, pedido mayorista"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label>Agregar producto terminado</Label>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select
                value={selectedProductoId}
                onValueChange={(v) => setSelectedProductoId(v ?? '')}
                disabled={terminadosDisponibles.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      terminadosDisponibles.length === 0
                        ? 'Sin productos disponibles'
                        : 'Seleccionar producto'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {terminadosDisponibles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Cant."
              className="w-24"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddItem}
              disabled={!selectedProductoId || !cantidad || Number(cantidad) <= 0}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Productos del pedido</Label>
            {items.map((item) => {
              const product = terminados.find((t) => t.id === item.productoId)
              const unit = product?.unidad ? ` ${product.unidad}` : ''
              const tieneReceta = (recetas[item.productoId]?.length ?? 0) > 0
              return (
                <div
                  key={item.productoId}
                  className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{product?.nombre}</span>
                    <span className="text-muted-foreground">
                      {item.cantidad}
                      {unit}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.productoId)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <Button
          onClick={() => setStep(2)}
          disabled={items.length === 0}
        >
          Ver resumen
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <div className="bg-muted rounded-md p-4 flex flex-col gap-4 text-sm">
        {descripcion && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Descripción</span>
            <span className="font-medium text-right">{descripcion}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground font-medium">Productos</span>
          {items.map((item) => {
            const product = terminados.find((t) => t.id === item.productoId)
            const unit = product?.unidad ? ` ${product.unidad}` : ''
            return (
              <div key={item.productoId} className="flex justify-between pl-2">
                <span>{product?.nombre}</span>
                <span className="font-medium">
                  {item.cantidad}
                  {unit}
                </span>
              </div>
            )
          })}
        </div>

        {impacto.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground font-medium">Insumos descontados</span>
              {impacto.map(({ insumoId, insumoNombre, insumoUnidad, totalDescontado, stockActual }) => {
                const unit = insumoUnidad ? ` ${insumoUnidad}` : ''
                const stockResultante = stockActual - totalDescontado
                return (
                  <div key={insumoId} className="flex justify-between pl-2">
                    <span>{insumoNombre}</span>
                    <span
                      className={
                        stockResultante < 0 ? 'text-destructive font-medium' : 'font-medium'
                      }
                    >
                      -{totalDescontado}{unit}{' '}
                      <span className="text-muted-foreground font-normal">
                        ({stockActual}{unit} → {stockResultante}{unit})
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={isPending}>
          Volver
        </Button>
        <Button onClick={handleConfirmar} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registrando...
            </>
          ) : (
            'Confirmar pedido'
          )}
        </Button>
      </div>
    </div>
  )
}

type ImpactoItem = {
  insumoId: string
  insumoNombre: string
  insumoUnidad: string | null
  totalDescontado: number
  stockActual: number
}

function computeImpacto(items: OrderItem[], recetas: Recetas): ImpactoItem[] {
  const map = new Map<string, ImpactoItem>()
  for (const item of items) {
    for (const r of recetas[item.productoId] ?? []) {
      const prev = map.get(r.insumoId)
      map.set(r.insumoId, {
        insumoId: r.insumoId,
        insumoNombre: r.insumoNombre,
        insumoUnidad: r.insumoUnidad,
        totalDescontado: (prev?.totalDescontado ?? 0) + r.cantidad * item.cantidad,
        stockActual: r.insumoStock,
      })
    }
  }
  return Array.from(map.values())
}
