import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { useVesper } from '../store/useVesper'
import type { PrayerKind } from '../types'

export function AddPrayerSheet({ onClose }: { onClose: () => void }) {
  const addPrayer = useVesper((s) => s.addPrayer)
  const canvases = useVesper((s) => s.canvases)
  const visibleCanvasIds = useVesper((s) => s.visibleCanvasIds)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<PrayerKind>('request')
  const [canvasId, setCanvasId] = useState(
    () => (visibleCanvasIds.length === 1 ? visibleCanvasIds[0] : canvases[0]?.id) ?? ''
  )

  const submit = (e: FormEvent, close: () => void) => {
    e.preventDefault()
    if (!title.trim()) return
    addPrayer(title, description, canvasId || undefined, kind)
    close()
  }

  return (
    <Sheet title="New prayer" onClose={onClose}>
      {(close) => (
        <form className="form" onSubmit={(e) => submit(e, close)}>
          <div className="field">
            <span>This prayer is for</span>
            <div className="chips">
              <button
                type="button"
                className={kind === 'request' ? 'is-active' : ''}
                onClick={() => setKind('request')}
              >
                A request
              </button>
              <button
                type="button"
                className={kind === 'person' ? 'is-active' : ''}
                onClick={() => setKind('person')}
              >
                A person
              </button>
            </div>
          </div>
          <label className="field">
            <span>{kind === 'person' ? 'Who are you praying for?' : 'What are you praying for?'}</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'person' ? 'e.g. Bob Smith' : 'e.g. Safe travels for Mum'}
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
              placeholder={
                kind === 'person'
                  ? 'Who they are to you, and what you carry for them'
                  : 'Anything you want to hold onto as you pray'
              }
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
