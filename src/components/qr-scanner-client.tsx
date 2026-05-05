'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QrScanner from 'qr-scanner'
import { Button } from '@/components/ui/button'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const router = useRouter()
  const [httpsError, setHttpsError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    if (!isSecure) setHttpsError(true)

    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  // iOS Safari blocks video.play() outside a user gesture even when camera
  // permission is already granted. Calling start() from onClick satisfies
  // the gesture requirement.
  function handleStart() {
    if (!videoRef.current) return
    setCameraError(null)

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

    scanner
      .start()
      .then(() => setScanning(true))
      .catch((err) => {
        scanner.destroy()
        scannerRef.current = null
        setCameraError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara.')
      })
  }

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

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border bg-muted">
        <video ref={videoRef} className="w-full" playsInline muted autoPlay />
      </div>

      {!scanning && !cameraError && (
        <div className="flex justify-center">
          <Button onClick={handleStart}>Iniciar cámara</Button>
        </div>
      )}

      {cameraError && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-destructive">{cameraError}</p>
          <Button variant="outline" onClick={handleStart}>Reintentar</Button>
        </div>
      )}

      {scanning && (
        <p className="text-sm text-muted-foreground text-center">
          Apuntá la cámara al código QR del producto.
        </p>
      )}
    </div>
  )
}
