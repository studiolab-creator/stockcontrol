import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { BottomNav } from '@/components/bottom-nav'
import { Toaster } from '@/components/ui/sonner'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {/* print:hidden wrappers — sidebar, bottom nav and toaster must not appear on QR print sheets */}
      <div className="print:hidden contents">
        <AppSidebar />
      </div>
      <SidebarInset>
        <main className="flex-1 p-6 pb-20 md:pb-6 print:p-0">
          {children}
        </main>
      </SidebarInset>
      <div className="print:hidden">
        <BottomNav />
        <Toaster richColors position="top-right" />
      </div>
    </SidebarProvider>
  )
}
