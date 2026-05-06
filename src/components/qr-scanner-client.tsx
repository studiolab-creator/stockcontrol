'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// No top-level qr-scanner import — its Worker/blob-URL init silently aborts
// on iOS Safari under ngrok. Use native BarcodeDetector on iOS 17+ / Chrome 88+
// and lazy-load qr-scanner as a fallback only when needed.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SCAN_INTERVAL_MS = 300
const GUM_TIMEOUT_MS = 12_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let qrScannerModule: any = null

async function detectQRCode(video: HTMLVideoElement): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ('BarcodeDetector' in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = await detector.detect(video)
    return results[0]?.rawValue ?? null
  }
  if (!qrScannerModule) {
    qrScannerModule = (await import('qr-scanner')).default
  }
  try {
    const result = await qrScannerModule.scanImage(video, {
      returnDetailedScanResult: true,
    })
    return result.data as string
  } catch {
    return null
  }
}

export function QrScannerClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // All browser-dependent flags start as null so the server render and first
  // client render produce identical output — no hydration mismatch.
  const [httpsOk, setHttpsOk] = useState<boolean | null>(null)
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [starting, setStarting] = useState(false)
  // Diagnostic counter — FIRST thing in handleStart. If this never increments
  // after tapping, onClick is not firing (hydration/JavaScript issue).
  const [tapCount, setTapCount] = useState(0)

  useEffect(() => {
    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    setHttpsOk(isSecure)
    setHasCamera(Boolean(navigator.mediaDevices?.getUserMedia))
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
    setTapCount((n) => n + 1)

    if (starting) return

    const video = videoRef.current
    if (!video) {
      setCameraError('Error interno: referencia de video nula. Recargá la página.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Cámara no disponible. Asegurate de acceder por HTTPS.')
      return
    }

    setCameraError(null)
    setStarting(true)

    gumTimerRef.current = setTimeout(() => {
      gumTimerRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setStarting(false)
      setCameraError('La cámara tardó demasiado. Tocá de nuevo para reintentar.')
    }, GUM_TIMEOUT_MS)

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
          const v = videoRef.current
          if (!v || v.readyState < 2) return
          detectQRCode(v).then((data) => {
            if (data && UUID_RE.test(data)) {
              stopCamera()
              router.push(`/reducir/${data}`)
            }
          })
        }, SCAN_INTERVAL_MS)
      })
      .catch((err) => {
        if (gumTimerRef.current !== null) {
          clearTimeout(gumTimerRef.current)
          gumTimerRef.current = null
        }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        setStarting(false)
        setCameraError(
          err instanceof Error ? err.message : 'No se pudo acceder a la cámara.',
        )
      })
  }

  // httpsOk===null means we haven't run on the client yet — show nothing to
  // avoid flash of wrong content. After useEffect it becomes true or false.
  if (httpsOk === null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="w-full max-w-sm mx-auto aspect-video rounded-lg bg-muted/40 border border-border" />
        <p className="text-center text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (httpsOk === false) {
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

      {/* Always-visible diagnostic — stays outside scanning conditional */}
      <p className="text-xs text-muted-foreground text-center">
        toques: {tapCount} | scanning: {String(scanning)} | starting: {String(starting)} |{' '}
        cam: {hasCamera === null ? '?' : hasCamera ? 'ok' : 'no'}
      </p>

      {!scanning && (
        <div className="flex flex-col items-center gap-3">
          {cameraError && (
            <p className="text-sm text-destructive text-center">{cameraError}</p>
          )}
          <button
            onClick={handleStart}
            disabled={starting}
            style={{
              padding: '12px 32px',
              background: '#1d4ed8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: starting ? 0.5 : 1,
            }}
          >
            {starting ? 'Iniciando...' : cameraError ? 'Reintentar' : 'Iniciar cámara'}
          </button>
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
