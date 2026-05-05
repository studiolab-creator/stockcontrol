import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ReducirNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-base font-semibold text-foreground mb-1">
        Producto no encontrado
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        El código QR no corresponde a ningún producto registrado.
        Puede que el producto haya sido eliminado.
      </p>
      <Button variant="ghost" render={<Link href="/escanear" />}>
        Volver a escanear
      </Button>
    </div>
  )
}
