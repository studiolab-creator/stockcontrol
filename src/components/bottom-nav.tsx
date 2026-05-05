'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, History, QrCode, Bell, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/qr', label: 'QR', icon: QrCode },
  { href: '/escanear', label: 'Escanear', icon: ScanLine },
  { href: '/alertas', label: 'Alertas', icon: Bell },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    // Visible only below md breakpoint; hidden on desktop per D-10
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden h-16 bg-card border-t border-border"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {/* 10px label per UI-SPEC */}
            <span className="text-[10px] leading-none">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
