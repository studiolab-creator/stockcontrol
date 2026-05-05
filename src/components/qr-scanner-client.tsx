'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QrScanner from 'qr-scanner'
import { Button } from '@/components/ui/button'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Scan 3 times per second — fast enough to be responsive, not so fast as to overwhelm the engine
const SCAN_INTERVAL_MS = 300

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // BarcodeDetector is typed by qr-scanner's own .d.ts but not in lib.dom — cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<Promise<Worker | any> | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const [httpsError, setHttpsError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    if (!isSecure) {
      setHttpsError(true)
      return
    }
    // Pre-warm the QR engine (BarcodeDetector on iOS 17+, Worker otherwise)
    engineRef.current = QrScanner.createQrEngine()
    return stopCamera
  }, [])

  function stopCamera() {
    if (scanTimerRef.current !== null) {
      clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }

  // qr-scanner's start() calls getUserMedia through a 6-attempt retry loop where
  // each failure is silently swallowed. On iOS Safari the hung promise never
  // rejects, so start() freezes with no error and no camera.
  // Fix: call getUserMedia directly so we get real errors and control the flow.
  async function handleStart() {
    if (!videoRef.current || starting) return
    setStarting(true)
    setCameraError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false)
      setCameraError('Este navegador no soporta acceso a la cámara.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    } catch (err) {
      setStarting(false)
      setCameraError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara.')
      return
    }

    const video = videoRef.current
    streamRef.current = stream
    video.srcObject = stream

    try {
      await video.play()
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      video.srcObject = null
      setStarting(false)
      setCameraError(err instanceof Error ? err.message : 'No se pudo iniciar el video.')
      return
    }

    setStarting(false)
    setScanning(true)

    // Decode loop — QrScanner.scanImage() uses the pre-warmed engine and does
    // NOT call getUserMedia; it only decodes a single frame from the video element.
    scanTimerRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      QrScanner.scanImage(videoRef.current, {
        returnDetailedScanResult: true,
        qrEngine: engineRef.current ?? undefined,
      })
        .then(({ data }) => {
          if (UUID_RE.test(data)) {
            stopCamera()
            router.push(`/reducir/${data}`)
          }
        })
        .catch(() => {
          // No QR code found in this frame — normal, keep scanning
        })
    }, SCAN_INTERVAL_MS)
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
      <div className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border bg-muted/40">
        <video ref={videoRef} className="w-full" playsInline muted autoPlay />
      </div>

      {!scanning && (
        <div className="flex flex-col items-center gap-3">
          {cameraError && (
            <p className="text-sm text-destructive text-center">{cameraError}</p>
          )}
          <Button onClick={handleStart} disabled={starting}>
            {starting ? 'Iniciando...' : cameraError ? 'Reintentar' : 'Iniciar cámara'}
          </Button>
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
