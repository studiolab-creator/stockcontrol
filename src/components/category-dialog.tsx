'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

type ActionFn = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>

type CategoryDialogProps = {
  action: ActionFn
  mode: 'create' | 'edit'
  defaultValues?: { nombre: string }
}

export function CategoryDialog({ action, mode, defaultValues }: CategoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(action, undefined)
  // Track whether a submit has been made in the current dialog session
  const submittedRef = useRef(false)

  // Close dialog and show success toast when action returns undefined after submit
  useEffect(() => {
    if (submittedRef.current && state === undefined && !pending) {
      setOpen(false)
      toast.success('Categoría guardada correctamente.')
      submittedRef.current = false
    }
  }, [state, pending])

  // Reset submitted ref when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      submittedRef.current = false
    }
    setOpen(nextOpen)
  }

  const triggerLabel = mode === 'create' ? 'Nueva categoría' : 'Editar'
  const dialogTitle = mode === 'create' ? 'Nueva categoría' : 'Editar categoría'

  return (
    <>
      <Button
        variant={mode === 'create' ? 'default' : 'ghost'}
        size={mode === 'edit' ? 'sm' : 'default'}
        onClick={() => handleOpenChange(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {/* Server-level error (e.g., duplicate name, generic failure) */}
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <form
            action={(formData) => {
              submittedRef.current = true
              formAction(formData)
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                type="text"
                defaultValue={defaultValues?.nombre ?? ''}
                disabled={pending}
                autoFocus
                aria-describedby={
                  state?.errors?.nombre ? 'nombre-error' : undefined
                }
              />
              {/* Field-level validation error */}
              {state?.errors?.nombre && (
                <p id="nombre-error" className="text-sm text-destructive">
                  {state.errors.nombre[0]}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Descartar cambios
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar categoría'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
