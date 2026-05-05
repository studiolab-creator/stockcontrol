'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QrScanner from 'qr-scanner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SCAN_INTERVAL_MS = 300
// getUserMedia on iOS Safari via ngrok can hang indefinitely (no resolve, no reject).
// After this many ms we abort and let the user retry.
const GUM_TIMEOUT_MS = 12_000

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // BarcodeDetector is typed by qr-scanner's own .d.ts but not in lib.dom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<Promise<Worker | any> | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const [httpsError, setHttpsError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [starting, setStarting] = useState(false)
  // Diagnostic: counts raw taps regardless of guard state so we can tell if
  // onClick fires at all. Shown on screen to debug iOS Safari behavior.
  const [tapCount, setTapCount] = useState(0)

  useEffect(() => {
    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    if (!isSecure) {
      setHttpsError(true)
      return
    }
    engineRef.current = QrScanner.createQrEngine()
    return () => {
      stopCamera()
      if (gumTimerRef.current !== null) clearTimeout(gumTimerRef.current)
    }
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

  function handleStart() {
    // Count every tap first — lets us see if onClick fires at all
    setTapCount((n) => n + 1)

    if (starting) return

    if (!videoRef.current) {
      setCameraError('Error interno: video no disponible. Recargá la página.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador no soporta acceso a la cámara.')
      return
    }

    const video = videoRef.current
    setCameraError(null)
    setStarting(true)

    // Start a watchdog: if getUserMedia neither resolves nor rejects within
    // GUM_TIMEOUT_MS, it has silently hung (common on iOS Safari via ngrok).
    // Reset starting so the button is re-enabled and the user can retry.
    gumTimerRef.current = setTimeout(() => {
      gumTimerRef.current = null
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      video.srcObject = null
      setStarting(false)
      setCameraError(
        'La cámara tardó demasiado en responder. Tocá de nuevo para reintentar.',
      )
    }, GUM_TIMEOUT_MS)

    // Call getUserMedia synchronously within the click handler so iOS Safari
    // recognises it as a direct user-gesture response.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (gumTimerRef.current !== null) {
          clearTimeout(gumTimerRef.current)
          gumTimerRef.current = null
        }
        streamRef.current = stream
        video.srcObject = stream
        return video.play()
      })
      .then(() => {
        setStarting(false)
        setScanning(true)

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
              // No QR code in this frame — normal, keep scanning
            })
        }, SCAN_INTERVAL_MS)
      })
      .catch((err) => {
        if (gumTimerRef.current !== null) {
          clearTimeout(gumTimerRef.current)
          gumTimerRef.current = null
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        video.srcObject = null
        setStarting(false)
        setCameraError(
          err instanceof Error ? err.message : 'No se pudo acceder a la cámara.',
        )
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
      <div className="w-full max-w-sm mx-auto aspect-video rounded-lg overflow-hidden border border-border bg-muted/40">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      </div>

      {!scanning && (
        <div className="flex flex-col items-center gap-3">
          {cameraError && (
            <p className="text-sm text-destructive text-center">{cameraError}</p>
          )}
          {/* Native button to guarantee iOS Safari registers taps */}
          <button
            onClick={handleStart}
            disabled={starting}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {starting ? 'Iniciando...' : cameraError ? 'Reintentar' : 'Iniciar cámara'}
          </button>
          <p className="text-xs text-muted-foreground">
            toques: {tapCount} | ref: {videoRef.current ? 'ok' : 'null'} |{' '}
            {typeof navigator !== 'undefined' && navigator.mediaDevices
              ? 'mediaDevices ok'
              : 'sin mediaDevices'}
          </p>
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
