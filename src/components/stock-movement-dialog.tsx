'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

type ActionFn = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>

type StockMovementDialogProps = {
  product: {
    id: string
    nombre: string
    stock: number
    unidad: string | null
  }
  action: ActionFn
  userRole: 'ADMIN' | 'OPERADOR'
  isLowStock?: boolean
}

type Step = 1 | 2
type MovementType = 'entrada' | 'salida'
type FormValues = { quantity: number; motivo: string; type: MovementType }

export function StockMovementDialog({
  product,
  action,
  userRole,
  isLowStock = false,
}: StockMovementDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [values, setValues] = useState<FormValues>({
    quantity: 0,
    motivo: '',
    type: 'entrada',
  })

  const [state, formAction, pending] = useActionState(action, undefined)
  // Prevents the useEffect from closing the dialog on initial mount
  // when state === undefined (the initial value). See RESEARCH.md Pitfall 5.
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state === undefined && !pending) {
      // Reset step and values here because setOpen(false) doesn't trigger
      // onOpenChange, so handleOpenChange never runs on programmatic close.
      setStep(1)
      setValues({ quantity: 0, motivo: '', type: 'entrada' })
      setOpen(false)
      toast.success('Stock actualizado')
      submittedRef.current = false
    }
  }, [state, pending])

  useEffect(() => {
    if (submittedRef.current && state?.error && !pending) {
      if (state.error.includes('Verificá')) {
        toast.error('No se pudo aplicar el movimiento. Verificá el stock actual.')
      } else {
        toast.error('Ocurrió un error. Intentá de nuevo.')
      }
    }
  }, [state, pending])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(1)
      setValues({ quantity: 0, motivo: '', type: 'entrada' })
    }
    submittedRef.current = false
    setOpen(nextOpen)
  }

  const handleVerResumen = () => {
    if (values.quantity > 0) setStep(2)
  }

  const delta = values.type === 'salida' ? -values.quantity : values.quantity
  const projectedStock = product.stock + delta
  const unit = product.unidad ? ` ${product.unidad}` : ''

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'w-full',
          isLowStock && 'border-destructive text-destructive hover:bg-destructive/5',
        )}
        onClick={() => setOpen(true)}
      >
        + Agregar stock
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[420px]">

          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>Agregar stock</DialogTitle>
                <p className="text-sm text-muted-foreground">{product.nombre}</p>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleVerResumen()
                }}
                className="flex flex-col gap-4"
              >
                {userRole === 'ADMIN' && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={values.type}
                      onValueChange={(v) =>
                        setValues((prev) => ({ ...prev, type: v as MovementType }))
                      }
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="salida">Salida manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="quantity">
                    {values.type === 'salida' ? 'Cantidad a restar' : 'Cantidad'}
                  </Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="0"
                    value={values.quantity === 0 ? '' : values.quantity}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        quantity: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="motivo">Motivo (opcional)</Label>
                  <Textarea
                    id="motivo"
                    name="motivo"
                    rows={2}
                    placeholder="Ej: compra enero, ajuste inventario"
                    value={values.motivo}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, motivo: e.target.value }))
                    }
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={values.quantity <= 0}
                  >
                    Ver resumen
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar movimiento</DialogTitle>
              </DialogHeader>

              {state?.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="bg-muted rounded-md p-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Producto</span>
                  <span className="font-medium">{product.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cantidad</span>
                  <span
                    className={cn(
                      'font-medium',
                      delta > 0 ? 'text-emerald-600' : 'text-destructive',
                    )}
                  >
                    {delta > 0 ? `+${delta}` : `${delta}`}{unit}
                  </span>
                </div>
                {values.motivo && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Motivo</span>
                    <span className="font-medium text-right">{values.motivo}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock</span>
                  <span className="font-medium">
                    <span className="text-muted-foreground">{product.stock}{unit}</span>
                    {' → '}
                    <span>{projectedStock}{unit}</span>
                  </span>
                </div>
              </div>

              <form
                action={(fd) => {
                  fd.set('delta', String(delta))
                  fd.set('motivo', values.motivo)
                  submittedRef.current = true
                  formAction(fd)
                }}
              >
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    disabled={pending}
                  >
                    Volver
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      'Confirmar'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

        </DialogContent>
      </Dialog>
    </>
  )
}
