'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { eliminarPedido } from './actions'

type PedidoItem = {
  id: string
  cantidad: number
  producto: { nombre: string; unidad: string | null }
}

type Pedido = {
  id: string
  createdAt: Date
  descripcion: string | null
  user: { username: string }
  items: PedidoItem[]
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function DeleteButton({ pedido }: { pedido: Pedido }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await eliminarPedido(pedido.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Pedido anulado y stock restablecido')
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={isPending}
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular este pedido?</AlertDialogTitle>
          <AlertDialogDescription>
            Se restablecerá el stock de todos los insumos descontados por este pedido.
            {pedido.descripcion && (
              <span className="block mt-1 font-medium text-foreground">
                "{pedido.descripcion}"
              </span>
            )}
            <span className="block mt-2">
              {pedido.items.map((item) => {
                const unit = item.producto.unidad ? ` ${item.producto.unidad}` : ''
                return `${item.producto.nombre} × ${item.cantidad}${unit}`
              }).join(', ')}
            </span>
            <span className="block mt-2 text-destructive font-medium">
              Esta acción no se puede deshacer.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Anular pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PedidosTable({ pedidos }: { pedidos: Pedido[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Productos</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {pedidos.map((pedido) => (
          <TableRow key={pedido.id} className="hover:bg-muted/50 align-top">
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {dateFormatter.format(new Date(pedido.createdAt))}
            </TableCell>
            <TableCell className="text-sm">{pedido.user.username}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {pedido.descripcion ?? '—'}
            </TableCell>
            <TableCell className="text-sm">
              <ul className="flex flex-col gap-0.5">
                {pedido.items.map((item) => {
                  const unit = item.producto.unidad ? ` ${item.producto.unidad}` : ''
                  return (
                    <li key={item.id} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{item.producto.nombre}</span>
                      {' '}× {item.cantidad}{unit}
                    </li>
                  )
                })}
              </ul>
            </TableCell>
            <TableCell className="text-right">
              <DeleteButton pedido={pedido} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
