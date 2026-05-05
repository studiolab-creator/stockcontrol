'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// UUID v4 regex: 8-4-4-4-12 hex chars with hyphens
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<import('qr-scanner').default | null>(null)
  const router = useRouter()
  const [httpsError, setHttpsError] = useState(false)

  useEffect(() => {
    // HTTPS check — getUserMedia fails on non-HTTPS non-localhost (RESEARCH.md Pitfall 6, CLAUDE.md constraint)
    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    if (!isSecure) {
      setHttpsError(true)
      return
    }

    if (!videoRef.current) return

    // Dynamic import inside useEffect — second SSR safety layer.
    // Primary guard is ssr: false in escanear/page.tsx (RESEARCH.md Pitfall 1).
    // The import() here also prevents the module from loading on any non-browser render.
    import('qr-scanner').then(({ default: QrScanner }) => {
      const scanner = new QrScanner(
        videoRef.current!,
        (result) => {
          const uuid = result.data
          // Only navigate for valid UUID v4 — prevents acting on arbitrary QR codes
          // D-05: on successful scan, auto-navigate to /reducir/[productId]
          if (UUID_RE.test(uuid)) {
            scanner.stop()
            router.push(`/reducir/${uuid}`)
          }
        },
        {
          returnDetailedScanResult: true,     // result.data instead of deprecated string arg
          preferredCamera: 'environment',     // rear camera on mobile
          onDecodeError: (err) => {
            // Fires every frame when no QR found — this is normal, not an error (RESEARCH.md Pitfall 3)
            if (err === QrScanner.NO_QR_CODE_FOUND) return
            console.error('QR decode error:', err)
          },
        },
      )
      scannerRef.current = scanner
      scanner.start().catch((err) => {
        console.error('Camera start failed:', err)
      })
    })

    // Cleanup: destroy stops the camera stream and terminates the Web Worker.
    // Required to prevent battery drain after navigation (RESEARCH.md Pitfall 1).
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [router])

  if (httpsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-semibold text-foreground mb-1">
          Se requiere conexion segura
        </p>
        <p className="text-sm text-muted-foreground">
          La camara solo funciona en HTTPS. Accede desde la URL segura de la aplicacion.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Apunta la camara al codigo QR del producto.
      </p>
      <div className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border">
        <video ref={videoRef} className="w-full" />
      </div>
    </div>
  )
}
