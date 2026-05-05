import { getAuthenticatedUser } from '@/lib/dal'
import { QrScannerLoader } from '@/components/qr-scanner-loader'

export default async function EscanearPage() {
  // Any authenticated user (ADMIN or OPERADOR) can scan QR codes
  await getAuthenticatedUser()

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Escanear QR</h1>
      <QrScannerLoader />
    </div>
  )
}
