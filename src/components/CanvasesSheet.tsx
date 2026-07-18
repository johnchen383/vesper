import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { MAX_PER_CANVAS, useVesper } from '../store/useVesper'
import { CloseIcon, PencilIcon, TrashIcon } from './icons'

export function CanvasesSheet({ onClose }: { onClose: () => void }) {
  const canvases = useVesper((s) => s.canvases)
  const visibleCanvasIds = useVesper((s) => s.visibleCanvasIds)
  const prayers = useVesper((s) => s.prayers)
  const { addCanvas, renameCanvas, removeCanvas, toggleCanvasVisible } = useVesper.getState()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const submitNew = (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    addCanvas(newName)
    setNewName('')
  }

  const submitRename = (e: FormEvent) => {
    e.preventDefault()
    if (editingId && editName.trim()) renameCanvas(editingId, editName)
    setEditingId(null)
  }

  return (
    <Sheet title="Canvas" onClose={onClose}>
      {canvases.map((canvas) => {
        const count = prayers.filter(
          (p) => p.canvasId === canvas.id && p.status === 'active'
        ).length
        if (editingId === canvas.id) {
          return (
            <form className="canvasrow" key={canvas.id} onSubmit={submitRename}>
              <input
                autoFocus
                className="canvasrow__input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={40}
              />
              <button className="btn btn--primary" type="submit" disabled={!editName.trim()}>
                Save
              </button>
              <button className="btn" type="button" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </form>
          )
        }
        const total = prayers.filter((p) => p.canvasId === canvas.id).length
        if (confirmDeleteId === canvas.id) {
          return (
            <div className="canvasrow" key={canvas.id}>
              <span className="canvasrow__name">Delete {canvas.name}?</span>
              <button
                className="btn canvasrow__confirm"
                onClick={() => {
                  removeCanvas(canvas.id, false)
                  setConfirmDeleteId(null)
                }}
              >
                Keep prayers
              </button>
              <button
                className="btn btn--danger canvasrow__confirm"
                onClick={() => {
                  removeCanvas(canvas.id, true)
                  setConfirmDeleteId(null)
                }}
              >
                Delete {total}
              </button>
              <button
                className="icon-btn"
                aria-label="Cancel"
                onClick={() => setConfirmDeleteId(null)}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          )
        }
        return (
          <div className="canvasrow" key={canvas.id}>
            <label className="canvasrow__vis">
              <input
                type="checkbox"
                checked={visibleCanvasIds.includes(canvas.id)}
                onChange={() => toggleCanvasVisible(canvas.id)}
              />
              <i className="toggle" />
            </label>
            <span className="canvasrow__name">
              {canvas.name} <em>{count >= MAX_PER_CANVAS ? `${count} · full` : count}</em>
            </span>
            <button
              className="icon-btn"
              aria-label={`Rename ${canvas.name}`}
              onClick={() => {
                setEditingId(canvas.id)
                setEditName(canvas.name)
                setConfirmDeleteId(null)
              }}
            >
              <PencilIcon size={15} />
            </button>
            {canvases.length > 1 && (
              <button
                className="icon-btn"
                aria-label={`Delete ${canvas.name}`}
                onClick={() => {
                  // Nothing inside: no need to ask what happens to prayers.
                  if (total === 0) removeCanvas(canvas.id)
                  else setConfirmDeleteId(canvas.id)
                }}
              >
                <TrashIcon size={15} />
              </button>
            )}
          </div>
        )
      })}

      <form className="canvasrow canvasrow--new" onSubmit={submitNew}>
        <input
          className="canvasrow__input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New canvas, e.g. Family"
          maxLength={40}
        />
        <button className="btn" type="submit" disabled={!newName.trim()}>
          Add
        </button>
      </form>
    </Sheet>
  )
}
