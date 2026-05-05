import { getAuthenticatedUser } from '@/lib/dal'
import { QrScannerClient } from '@/components/qr-scanner-client'

// QrScannerClient is 'use client' — Next.js treats it as a client boundary and
// never server-renders it. All browser APIs (getUserMedia, Worker) are inside
// useEffect, so no dynamic() wrapper or ssr:false guard is needed.
export default async function EscanearPage() {
  await getAuthenticatedUser()

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Escanear QR</h1>
      <QrScannerClient />
    </div>
  )
}
