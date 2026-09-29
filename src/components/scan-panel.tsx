import { useEffect, useRef, useState } from 'react'

export function ScanPanel({ onResult }: { onResult: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active || !videoRef.current) return
    let disposed = false
    let stop: (() => void) | undefined
    void import('@zxing/browser')
      .then(async ({ BrowserQRCodeReader }) => {
        if (disposed || !videoRef.current) return
        try {
          const reader = new BrowserQRCodeReader()
          const controls = await reader.decodeFromVideoDevice(
            undefined,
            videoRef.current,
            (result) => {
              if (!result || disposed) return
              onResult(result.getText())
              setActive(false)
            },
          )
          stop = () => controls.stop()
          if (disposed) stop()
        } catch {
          if (!disposed) {
            setError(
              'Camera access is unavailable. Paste the payment code below.',
            )
            setActive(false)
          }
        }
      })
      .catch(() => {
        if (!disposed) {
          setError(
            'The camera scanner could not start. Paste the payment code below.',
          )
          setActive(false)
        }
      })
    return () => {
      disposed = true
      stop?.()
    }
  }, [active, onResult])

  return (
    <div className="pay-scanner">
      {active ? (
        <div className="pay-camera">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Camera view for scanning a BOBC payment QR"
          />
          <span className="pay-scan-frame" aria-hidden="true" />
        </div>
      ) : (
        <div className="pay-scan-art" aria-hidden="true">
          <span className="pay-scan-art-corners" />
          <img src="/bobc.svg" alt="" />
        </div>
      )}
      <div className="pay-scanner-copy">
        <strong>{active ? 'Point at a BOBC QR' : 'Scan a payment'}</strong>
        <span>
          {active
            ? 'Keep the code inside the frame.'
            : 'Use your camera or paste a payment code.'}
        </span>
      </div>
      <button
        type="button"
        className="btn"
        data-variant={active ? 'ghost' : undefined}
        onClick={() => {
          setError(null)
          setActive((value) => !value)
        }}
      >
        {active ? 'Stop camera' : 'Open camera'}
      </button>
      {error ? (
        <p className="pay-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
