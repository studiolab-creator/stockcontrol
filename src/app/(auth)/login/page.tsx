'use client'
import { useActionState } from 'react'
import { useState } from 'react'
import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="w-full max-w-[400px] rounded-lg border bg-card p-8 shadow-sm">
      {/* Display heading — 28px semibold per UI-SPEC typography table */}
      <h1 className="text-[28px] font-semibold leading-[1.1] text-foreground mb-1">
        StockControl
      </h1>
      {/* Subheading — 14px muted per UI-SPEC */}
      <p className="text-sm text-muted-foreground mb-6">
        Iniciá sesión para continuar
      </p>

      {/* Error alert — shown when loginAction returns { error } */}
      {state?.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            disabled={pending}
            placeholder="tu.usuario"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={pending}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full mt-2" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar sesión'
          )}
        </Button>
      </form>

      {/* No "forgot password" link — passwords reset by admin only per CONTEXT.md */}
    </div>
  )
}
