import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CloseIcon } from './icons'

export interface SheetAnchor {
  x: number
  y: number
  r: number
}

interface Props {
  title?: string
  onClose: () => void
  /**
   * Plain children, or a function receiving `close` — call it instead of the
   * outer onClose so dismissal plays the exit animation first.
   */
  children: ReactNode | ((close: () => void) => ReactNode)
  /**
   * When set, the sheet floats next to that screen point (an orb) without
   * dimming the canvas — so the orb and its ripples stay visible.
   */
  anchor?: SheetAnchor
}

const CLOSE_MS = 200
const CARD_W = 380
const CARD_H = 420 // estimate for clamping; the card is usually shorter
const MARGIN = 16
const GAP = 28

function anchoredStyle(anchor: SheetAnchor): CSSProperties | undefined {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (vw < 600) return undefined // mobile keeps the bottom-sheet layout
  const w = Math.min(CARD_W, vw - 2 * MARGIN)

  // Prefer beside the orb: right of it, else left, else above/below.
  let left = anchor.x + anchor.r + GAP
  if (left + w > vw - MARGIN) left = anchor.x - anchor.r - GAP - w
  let top = anchor.y - CARD_H * 0.4
  if (left < MARGIN) {
    left = Math.min(Math.max(MARGIN, anchor.x - w / 2), vw - w - MARGIN)
    top = anchor.y + anchor.r + GAP
    if (top + CARD_H > vh - MARGIN) top = anchor.y - anchor.r - GAP - CARD_H
  }
  top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - CARD_H - MARGIN))

  return { position: 'fixed', left, top, width: w }
}

export function Sheet({ title, onClose, children, anchor }: Props) {
  const [closing, setClosing] = useState(false)
  const timerRef = useRef(0)

  const close = () => {
    if (closing) return
    setClosing(true)
    timerRef.current = window.setTimeout(onClose, CLOSE_MS)
  }

  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(timerRef.current)
    }
  }, [])

  const floatStyle = anchor ? anchoredStyle(anchor) : undefined

  return (
    <div
      className={`sheet-backdrop ${anchor ? 'sheet-backdrop--clear' : ''} ${
        closing ? 'sheet-backdrop--closing' : ''
      }`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className={`sheet ${floatStyle ? 'sheet--float' : ''}`}
        style={floatStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="sheet__header">
          {title ? <h2>{title}</h2> : <span />}
          <button className="icon-btn" onClick={close} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </header>
        <div className="sheet__body">
          {typeof children === 'function' ? children(close) : children}
        </div>
      </div>
    </div>
  )
}
