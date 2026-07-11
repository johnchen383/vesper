import { useEffect, useState, type RefObject } from 'react'
import type { OrbEngine } from '../canvas/engine'

export function FpsMeter({ engineRef }: { engineRef: RefObject<OrbEngine | null> }) {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setFps(Math.round(engineRef.current?.fps ?? 0)), 500)
    return () => clearInterval(timer)
  }, [engineRef])

  return <div className="fps">{fps} fps</div>
}
