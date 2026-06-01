'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type Product = { id: string; nombre: string; stock: number; unidad: string | null }

type ActionState =
  | { error?: string; errors?: Record<string, string[]>; success?: true }
  | undefined

type ActionFn = (prevState: ActionState, formData: FormData) => Promise<ActionState>

type Props = {
  product: Product
  action: ActionFn
}

type Step = 1 | 2

export function ReducirClient({ product, action }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [cantidad, setCantidad] = useState(0)
  const [state, formAction, pending] = useActionState(action, undefined)
  const submittedRef = useRef(false)

  const unit = product.unidad ? ` ${product.unidad}` : ''
  const projectedStock = product.stock - cantidad

  // Success: show toast, render success state
  useEffect(() => {
    if (submittedRef.current && (state as { success?: boolean })?.success && !pending) {
      toast.success('Stock reducido correctamente')
      submittedRef.current = false
    }
  }, [state, pending])

  // Error: reset submitted flag so error displays inline on step 2
  useEffect(() => {
    if (submittedRef.current && (state as { error?: string })?.error && !pending) {
      submittedRef.current = false
    }
  }, [state, pending])

  const handleVerResumen = (e: React.FormEvent) => {
    e.preventDefault()
    if (cantidad > 0) setStep(2)
  }

  // After successful submission, show success state
  const isSuccess = (state as { success?: boolean })?.success === true && !pending

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Stock reducido
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Se redujo{' '}
          <span className="font-medium">
            {cantidad}
            {unit}
          </span>{' '}
          de <span className="font-medium">{product.nombre}</span>.
        </p>
        <Button variant="outline" render={<Link href="/escanear" />}>
          Escanear otro producto
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-sm">
      {/* Product info */}
      <div className="bg-muted rounded-md p-4 mb-6">
        <p className="text-sm text-muted-foreground mb-0.5">Producto</p>
        <p className="text-base font-semibold text-foreground">{product.nombre}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Stock actual:{' '}
          <span className="font-medium text-foreground">
            {product.stock}
            {unit}
          </span>
        </p>
      </div>

      {step === 1 && (
        <form onSubmit={handleVerResumen} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cantidad">Cantidad a restar</Label>
            <Input
              id="cantidad"
              name="cantidad"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="0"
              value={cantidad === 0 ? '' : cantidad}
              onChange={(e) =>
                setCantidad(Math.max(0, Number(e.target.value)))
              }
              autoFocus
            />
          </div>
          <Button type="submit" disabled={cantidad <= 0}>
            Ver resumen
          </Button>
        </form>
      )}

      {step === 2 && (
        <>
          {/* Error from previous submission attempt */}
          {(state as { error?: string })?.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {(state as { error?: string }).error}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted rounded-md p-4 flex flex-col gap-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad a restar</span>
              <span className={cn('font-medium', 'text-destructive')}>
                -{cantidad}
                {unit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock resultante</span>
              <span className="font-medium">
                <span className="text-muted-foreground">
                  {product.stock}
                  {unit}
                </span>
                {' → '}
                <span
                  className={cn(
                    projectedStock < 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {projectedStock}
                  {unit}
                </span>
              </span>
            </div>
          </div>

          <form
            action={(fd) => {
              fd.set('cantidad', String(cantidad))
              submittedRef.current = true
              formAction(fd)
            }}
            className="flex gap-3"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              disabled={pending}
            >
              Volver
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar reducción'
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
