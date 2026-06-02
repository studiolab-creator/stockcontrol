'use client'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearProductoParaReceta } from './actions'

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export function NuevoProductoForm() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    crearProductoParaReceta,
    undefined,
  )

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + Nuevo producto
      </Button>
    )
  }

  return (
    <form action={formAction} className="border rounded-lg p-4 flex flex-col gap-4 max-w-md">
      <p className="text-sm font-medium text-foreground">Nuevo producto para receta</p>
      <p className="text-xs text-muted-foreground -mt-2">
        No aparecerá en el dashboard. Al guardar, pasás directo a configurar su receta.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre">Nombre <span className="text-destructive">*</span></Label>
        <Input
          id="nombre"
          name="nombre"
          placeholder="Ej: Combo Desayuno"
          autoFocus
          disabled={pending}
        />
        {state?.errors?.nombre && (
          <p className="text-sm text-destructive">{state.errors.nombre[0]}</p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="sku">SKU (opcional)</Label>
          <Input id="sku" name="sku" placeholder="Ej: COMBO-01" disabled={pending} />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="unidad">Unidad (opcional)</Label>
          <Input id="unidad" name="unidad" placeholder="Ej: unidad, kg" disabled={pending} />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar y configurar receta'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
