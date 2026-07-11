import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { useVesper } from '../store/useVesper'

export function AddPrayerSheet({ onClose }: { onClose: () => void }) {
  const addPrayer = useVesper((s) => s.addPrayer)
  const canvases = useVesper((s) => s.canvases)
  const visibleCanvasIds = useVesper((s) => s.visibleCanvasIds)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [canvasId, setCanvasId] = useState(
    () => (visibleCanvasIds.length === 1 ? visibleCanvasIds[0] : canvases[0]?.id) ?? ''
  )

  const submit = (e: FormEvent, close: () => void) => {
    e.preventDefault()
    if (!title.trim()) return
    addPrayer(title, description, canvasId || undefined)
    close()
  }

  return (
    <Sheet title="New prayer" onClose={onClose}>
      {(close) => (
        <form className="form" onSubmit={(e) => submit(e, close)}>
          <label className="field">
            <span>What/Who are you praying for?</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bob Smith"
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>
              Details <em>(optional)</em>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Anything you want to hold onto as you pray"
            />
          </label>
          {canvases.length > 1 && (
            <div className="field">
              <span>Canvas</span>
              <div className="chips">
                {canvases.map((canvas) => (
                  <button
                    key={canvas.id}
                    type="button"
                    className={canvasId === canvas.id ? 'is-active' : ''}
                    onClick={() => setCanvasId(canvas.id)}
                  >
                    {canvas.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn--primary" type="submit" disabled={!title.trim()}>
            Add to the canvas
          </button>
        </form>
      )}
    </Sheet>
  )
}
