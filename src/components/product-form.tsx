'use client'
import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

type ActionFn = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>

type Category = { id: string; nombre: string }

type ProductFormProps = {
  action: ActionFn
  categories: Category[]
  defaultValues?: {
    nombre?: string
    descripcion?: string | null
    tipo?: string
    categoriaId?: string | null
    sku?: string | null
    unidad?: string | null
    minStock?: number
  }
  mode: 'create' | 'edit'
}

export function ProductForm({ action, categories, defaultValues, mode }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined)

  // Show server error as toast (non-field errors)
  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {/* Server-level error (non-field) */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Nombre — required */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nombre"
          name="nombre"
          type="text"
          defaultValue={defaultValues?.nombre ?? ''}
          disabled={pending}
          aria-describedby={state?.errors?.nombre ? 'nombre-error' : undefined}
        />
        {state?.errors?.nombre && (
          <p id="nombre-error" className="text-sm text-destructive">
            {state.errors.nombre[0]}
          </p>
        )}
      </div>

      {/* Descripción — optional, max 3 rows per UI-SPEC */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          defaultValue={defaultValues?.descripcion ?? ''}
          disabled={pending}
        />
      </div>

      {/* Tipo — required Select */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">
          Tipo <span className="text-destructive">*</span>
        </Label>
        <Select name="tipo" defaultValue={defaultValues?.tipo ?? ''} disabled={pending}>
          <SelectTrigger id="tipo" aria-describedby={state?.errors?.tipo ? 'tipo-error' : undefined}>
            <SelectValue placeholder="Seleccioná un tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TERMINADO">Terminado</SelectItem>
            <SelectItem value="INSUMO">Insumo</SelectItem>
          </SelectContent>
        </Select>
        {state?.errors?.tipo && (
          <p id="tipo-error" className="text-sm text-destructive">
            {state.errors.tipo[0]}
          </p>
        )}
      </div>

      {/* Categoría — optional Select from predefined list (D-04, D-05) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoriaId">Categoría</Label>
        <Select
          name="categoriaId"
          defaultValue={defaultValues?.categoriaId ?? ''}
          disabled={pending}
        >
          <SelectTrigger id="categoriaId">
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sin categoría</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* SKU — optional (D-07) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sku">SKU / Código</Label>
        <Input
          id="sku"
          name="sku"
          type="text"
          defaultValue={defaultValues?.sku ?? ''}
          disabled={pending}
          placeholder="Código interno del producto"
        />
      </div>

      {/* Unidad — optional (D-09) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unidad">Unidad de medida</Label>
        <Input
          id="unidad"
          name="unidad"
          type="text"
          defaultValue={defaultValues?.unidad ?? ''}
          disabled={pending}
          placeholder="Ej: kg, litros, unidades"
        />
      </div>

      {/* Stock mínimo — required, ≥ 0 (PROD-04) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="minStock">
          Stock mínimo <span className="text-destructive">*</span>
        </Label>
        <Input
          id="minStock"
          name="minStock"
          type="number"
          min={0}
          step="0.001"
          defaultValue={defaultValues?.minStock ?? 0}
          disabled={pending}
          aria-describedby={state?.errors?.minStock ? 'minstock-error' : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Cantidad mínima antes de recibir alerta
        </p>
        {state?.errors?.minStock && (
          <p id="minstock-error" className="text-sm text-destructive">
            {state.errors.minStock[0]}
          </p>
        )}
      </div>

      {/* Form actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar producto'
          )}
        </Button>
        <Button variant="ghost" render={<Link href="/productos" />} disabled={pending}>
          Volver a Productos
        </Button>
      </div>
    </form>
  )
}
