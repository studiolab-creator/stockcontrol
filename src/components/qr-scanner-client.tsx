'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<import('qr-scanner').default | null>(null)
  const router = useRouter()
  const [httpsError, setHttpsError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    if (!isSecure) {
      setHttpsError(true)
      return
    }

    if (!videoRef.current) return

    import('qr-scanner').then(({ default: QrScanner }) => {
      if (!active || !videoRef.current) return

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const uuid = result.data
          if (UUID_RE.test(uuid)) {
            scanner.stop()
            router.push(`/reducir/${uuid}`)
          }
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          onDecodeError: (err) => {
            if (err === QrScanner.NO_QR_CODE_FOUND) return
            console.error('QR decode error:', err)
          },
        },
      )
      scannerRef.current = scanner

      scanner.start().catch((err) => {
        if (!active) return
        const msg =
          err instanceof Error ? err.message : String(err)
        setCameraError(msg || 'No se pudo iniciar la cámara.')
      })
    })

    return () => {
      active = false
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [router])

  if (httpsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-semibold text-foreground mb-1">
          Se requiere conexión segura
        </p>
        <p className="text-sm text-muted-foreground">
          La cámara solo funciona en HTTPS. Accedé desde la URL segura de la aplicación.
        </p>
      </div>
    )
  }

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-semibold text-foreground mb-1">
          No se pudo acceder a la cámara
        </p>
        <p className="text-sm text-muted-foreground">{cameraError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Apuntá la cámara al código QR del producto.
      </p>
      <div className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border">
        {/* playsInline prevents iOS from going fullscreen before qr-scanner sets it */}
        <video ref={videoRef} className="w-full" playsInline muted />
      </div>
    </div>
  )
}
