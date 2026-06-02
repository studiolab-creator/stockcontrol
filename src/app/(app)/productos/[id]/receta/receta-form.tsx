'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Insumo = { id: string; nombre: string; unidad: string | null }
type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined
type ActionFn = (prevState: ActionState, formData: FormData) => Promise<ActionState>

export function RecetaForm({
  action,
  insumosDisponibles,
}: {
  action: ActionFn
  insumosDisponibles: Insumo[]
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  if (insumosDisponibles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todos los insumos disponibles ya están en la receta.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="insumoId">Insumo</Label>
        <Select name="insumoId" required>
          <SelectTrigger id="insumoId" className="w-[220px]">
            <SelectValue placeholder="Seleccionar insumo" />
          </SelectTrigger>
          <SelectContent>
            {insumosDisponibles.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.nombre}{i.unidad ? ` (${i.unidad})` : ''}
              </SelectItem>
            ))}
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
