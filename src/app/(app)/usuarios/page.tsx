import { requireAdmin } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { UserDialog } from '@/components/user-dialog'
import { createUser, updateUser, resetPassword } from './actions'

export default async function UsuariosPage() {
  await requireAdmin()

  const users = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    select: { id: true, username: true, role: true },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Usuarios</h1>
        <UserDialog action={createUser} mode="create" />
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-base font-semibold text-foreground mb-1">Sin usuarios</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Creá el primer usuario para dar acceso al sistema.
          </p>
          <UserDialog action={createUser} mode="create" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre de usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const boundUpdate = updateUser.bind(null, user.id)
              const boundReset = resetPassword.bind(null, user.id)
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {user.role === 'ADMIN' ? 'Admin' : 'Operador'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <UserDialog
                        action={boundUpdate}
                        mode="edit"
                        defaultValues={{ username: user.username, role: user.role }}
                      />
                      <UserDialog
                        action={boundReset}
                        mode="reset-password"
                        username={user.username}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
