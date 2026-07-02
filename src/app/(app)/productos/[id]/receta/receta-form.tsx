'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Ingrediente = { id: string; nombre: string; unidad: string | null; tipo: 'TERMINADO' | 'INSUMO' }
type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined
type ActionFn = (prevState: ActionState, formData: FormData) => Promise<ActionState>

export function RecetaForm({
  action,
  ingredientesDisponibles,
}: {
  action: ActionFn
  ingredientesDisponibles: Ingrediente[]
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  if (ingredientesDisponibles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todos los insumos y productos disponibles ya están en la receta.
      </p>
    )
  }

  const insumos = ingredientesDisponibles.filter((i) => i.tipo === 'INSUMO')
  const productos = ingredientesDisponibles.filter((i) => i.tipo === 'TERMINADO')

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="insumoId">Ingrediente</Label>
        <Select name="insumoId" required>
          <SelectTrigger id="insumoId" className="w-[220px]">
            <SelectValue placeholder="Seleccionar ingrediente" />
          </SelectTrigger>
          <SelectContent>
            {insumos.length > 0 && (
              <SelectGroup>
                <SelectLabel>Insumos</SelectLabel>
                {insumos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nombre}{i.unidad ? ` (${i.unidad})` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {productos.length > 0 && (
              <SelectGroup>
                <SelectLabel>Productos terminados</SelectLabel>
                {productos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nombre}{i.unidad ? ` (${i.unidad})` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        {state?.errors?.insumoId && (
          <p className="text-sm text-destructive">{state.errors.insumoId[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cantidad">Cantidad por unidad</Label>
        <Input
          id="cantidad"
          name="cantidad"
          type="number"
          min="0.001"
          step="0.001"
          placeholder="0"
          className="w-32"
        />
        {state?.errors?.cantidad && (
          <p className="text-sm text-destructive">{state.errors.cantidad[0]}</p>
        )}
      </div>

      <Button type="submit" variant="outline" disabled={pending}>
        Agregar
      </Button>

      {state?.error && (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      )}
    </form>
  )
}
