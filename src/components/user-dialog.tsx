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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

type ActionFn = (
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>

type UserDialogProps =
  | { mode: 'create'; action: ActionFn; defaultValues?: undefined; username?: undefined }
  | { mode: 'edit'; action: ActionFn; defaultValues: { username: string; role: string }; username?: undefined }
  | { mode: 'reset-password'; action: ActionFn; defaultValues?: undefined; username: string }

export function UserDialog({ action, mode, defaultValues, username }: UserDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(action, undefined)
  // Track whether a submit has been made in the current dialog session
  const submittedRef = useRef(false)

  // Close dialog and show success toast when action returns undefined after submit
  useEffect(() => {
    if (submittedRef.current && state === undefined && !pending) {
      setOpen(false)
      const messages: Record<string, string> = {
        create: 'Usuario guardado correctamente.',
        edit: 'Usuario guardado correctamente.',
        'reset-password': 'Contraseña restablecida correctamente.',
      }
      toast.success(messages[mode])
      submittedRef.current = false
    }
  }, [state, pending, mode])

  // Reset submitted ref when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      submittedRef.current = false
    }
    setOpen(nextOpen)
  }

  const triggerConfig: Record<
    string,
    { label: string; variant: 'default' | 'ghost'; size?: 'sm' | 'default'; isDestructive?: boolean }
  > = {
    create: { label: 'Nuevo usuario', variant: 'default' },
    edit: { label: 'Editar', variant: 'ghost', size: 'sm' },
    'reset-password': { label: 'Restablecer contraseña', variant: 'ghost', size: 'sm', isDestructive: true },
  }

  const dialogTitles: Record<string, string> = {
    create: 'Nuevo usuario',
    edit: 'Editar usuario',
    'reset-password': 'Restablecer contraseña',
  }

  const trigger = triggerConfig[mode]

  return (
    <>
      <Button
        variant={trigger.variant}
        size={trigger.size ?? 'default'}
        onClick={() => handleOpenChange(true)}
        className={trigger.isDestructive ? 'text-destructive hover:text-destructive' : ''}
      >
        {trigger.label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{dialogTitles[mode]}</DialogTitle>
            {mode === 'reset-password' && username && (
              <p className="text-sm text-muted-foreground">
                Ingresá una nueva contraseña para <strong>{username}</strong>.
              </p>
            )}
          </DialogHeader>

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
            {/* Create/Edit mode fields */}
            {(mode === 'create' || mode === 'edit') && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">Nombre de usuario</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    defaultValue={defaultValues?.username ?? ''}
                    disabled={pending}
                    autoFocus
                    aria-describedby={state?.errors?.username ? 'username-error' : undefined}
                  />
                  {state?.errors?.username && (
                    <p id="username-error" className="text-sm text-destructive">
                      {state.errors.username[0]}
                    </p>
                  )}
                </div>

                {mode === 'create' && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      disabled={pending}
                      aria-describedby={state?.errors?.password ? 'password-error' : undefined}
                    />
                    {state?.errors?.password && (
                      <p id="password-error" className="text-sm text-destructive">
                        {state.errors.password[0]}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    name="role"
                    defaultValue={defaultValues?.role ?? 'OPERADOR'}
                    disabled={pending}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Seleccioná un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Reset password mode fields */}
            {mode === 'reset-password' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    disabled={pending}
                    autoFocus
                    aria-describedby={state?.errors?.password ? 'password-error' : undefined}
                  />
                  {state?.errors?.password && (
                    <p id="password-error" className="text-sm text-destructive">
                      {state.errors.password[0]}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    disabled={pending}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Descartar cambios
              </Button>
              <Button
                type="submit"
                variant={mode === 'reset-password' ? 'destructive' : 'default'}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : mode === 'reset-password' ? (
                  'Guardar nueva contraseña'
                ) : (
                  'Guardar usuario'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
