import { useEffect, useState } from 'react'
import { FlameIcon, PlusIcon, SlidersIcon, StarIcon } from './icons'

interface Props {
  onAdd: () => void
  onPray?: () => void
  onAnswered?: () => void
  onSettings: () => void
}

export function Fab({ onAdd, onPray, onAnswered, onSettings }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.fab')) setOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutside)
    return () => window.removeEventListener('pointerdown', closeOnOutside)
  }, [open])

  const act = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className={`fab ${open ? 'fab--open' : ''}`}>
      <div className="fab__actions" aria-hidden={!open}>
        {onPray && (
          <button className="fab__action" tabIndex={open ? 0 : -1} onClick={act(onPray)}>
            <span>Pray</span>
            <FlameIcon size={17} />
          </button>
        )}
        <button className="fab__action" tabIndex={open ? 0 : -1} onClick={act(onSettings)}>
          <span>Settings</span>
          <SlidersIcon size={17} />
        </button>
        {onAnswered && (
          <button className="fab__action" tabIndex={open ? 0 : -1} onClick={act(onAnswered)}>
            <span>Answered</span>
            <StarIcon size={17} />
          </button>
        )}
        <button className="fab__action" tabIndex={open ? 0 : -1} onClick={act(onAdd)}>
          <span>New prayer</span>
          <PlusIcon size={17} />
        </button>
      </div>
      <button
        className="fab__main"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
      >
        <PlusIcon size={22} />
      </button>
    </div>
  )
}
