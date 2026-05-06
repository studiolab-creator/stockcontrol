'use client'
import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveGlobalAlertEmail } from './actions'

type ActionState = { error?: string; errors?: Record<string, string[]> } | undefined

export function AlertasEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveGlobalAlertEmail,
    undefined,
  )

  // Track whether a submit has been made so we can distinguish initial state from success
  const submittedRef = useRef(false)

  // Success: state === undefined after a submit (action returned undefined = success)
  useEffect(() => {
    if (submittedRef.current && state === undefined && !pending) {
      toast.success('Email guardado')
      submittedRef.current = false
    }
  }, [state, pending])

  // Error toast: server-level error (not field validation)
  useEffect(() => {
    if (submittedRef.current && state?.error && !pending) {
      toast.error('No se pudo guardar. Intentá de nuevo.')
      submittedRef.current = false
    }
  }, [state, pending])

  const emailError = state?.errors?.email?.[0]

  return (
    <form
      action={(fd) => {
        submittedRef.current = true
        formAction(fd)
      }}
      className="flex flex-col gap-4 max-w-sm"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="alert-email">Email</Label>
        <Input
          id="alert-email"
          name="email"
          type="email"
          placeholder="ej: equipo@empresa.com"
          defaultValue={currentEmail}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <p id="email-error" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar email'
        )}
      </Button>
    </form>
  )
}
