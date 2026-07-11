import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { useVesper } from '../store/useVesper'

export function AddPrayerSheet({ onClose }: { onClose: () => void }) {
  const addPrayer = useVesper((s) => s.addPrayer)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const submit = (e: FormEvent, close: () => void) => {
    e.preventDefault()
    if (!title.trim()) return
    addPrayer(title, description)
    close()
  }

  return (
    <Sheet title="New prayer" onClose={onClose}>
      {(close) => (
        <form className="form" onSubmit={(e) => submit(e, close)}>
          <label className="field">
            <span>What are you praying for?</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mum’s health"
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
          <button className="btn btn--primary" type="submit" disabled={!title.trim()}>
            Add to the canvas
          </button>
        </form>
      )}
    </Sheet>
  )
}
