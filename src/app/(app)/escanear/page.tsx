import dynamic from 'next/dynamic'
import { getAuthenticatedUser } from '@/lib/dal'

// CRITICAL: ssr: false prevents qr-scanner's Web Worker from being evaluated during SSR.
// The QrScannerClient component uses browser APIs (navigator.mediaDevices, Worker).
// Without this, Next.js will throw "ReferenceError: Worker is not defined" during SSR.
// (RESEARCH.md Pitfall 1 / CLAUDE.md architecture constraint for QR scanning)
const QrScannerClient = dynamic(
  () =>
    import('@/components/qr-scanner-client').then((m) => m.QrScannerClient),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Cargando camara...</p>
    ),
  },
)

export default async function EscanearPage() {
  // Any authenticated user (ADMIN or OPERADOR) can scan QR codes
  await getAuthenticatedUser()

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Escanear QR</h1>
      <QrScannerClient />
    </div>
  )
}
