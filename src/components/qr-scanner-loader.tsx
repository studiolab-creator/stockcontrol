'use client'
import dynamic from 'next/dynamic'

// dynamic() with ssr:false must live in a 'use client' file — calling it from a
// Server Component throws "ssr: false is not allowed with next/dynamic in Server Components".
const QrScannerDynamic = dynamic(
  () => import('./qr-scanner-client').then((m) => m.QrScannerClient),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Cargando cámara...</p>
    ),
  },
)

export function QrScannerLoader() {
  return <QrScannerDynamic />
}
