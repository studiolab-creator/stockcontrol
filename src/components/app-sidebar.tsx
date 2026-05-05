import Link from 'next/link'
import { LayoutDashboard, Package, History, QrCode, Bell, LogOut, ScanLine } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { logoutAction } from '@/app/(auth)/login/actions'
import { getAuthenticatedUser } from '@/lib/dal'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/qr', label: 'Gestión QR', icon: QrCode },
  { href: '/escanear', label: 'Escanear QR', icon: ScanLine },
  { href: '/alertas', label: 'Config. Alertas', icon: Bell },
]

export async function AppSidebar() {
  const user = await getAuthenticatedUser()
  // Initials for avatar: first 2 characters of username, uppercase
  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <Sidebar className="hidden md:flex" collapsible="none">
      <SidebarHeader className="p-4">
        {/* Logo / app name — 16px semibold per UI-SPEC */}
        <span className="text-base font-semibold text-foreground">StockControl</span>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2">
        {/* Main navigation — aria-label for accessibility per UI-SPEC */}
        <nav aria-label="Navegación principal">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors min-h-[40px]"
                    />
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarSeparator />

      {/* User info block — pinned to sidebar bottom per UI-SPEC */}
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {user.username}
            </span>
            <Badge
              variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
              className="w-fit text-xs"
            >
              {user.role === 'ADMIN' ? 'Admin' : 'Operador'}
            </Badge>
          </div>
        </div>
        {/* Logout — calls logoutAction Server Action */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
