import { useState, type FormEvent } from 'react'
import { Sheet, type SheetAnchor } from './Sheet'
import { CloseIcon, StarIcon } from './icons'
import type { PrayerKind } from '../types'
import { useVesper } from '../store/useVesper'
import { isSameDay, longDate, timeAgo } from '../lib/format'

interface Props {
  prayerId: string
  onClose: () => void
  onPrayed: (id: string) => void
  /** Fired when the prayer is marked answered — plays the ascension. */
  onAnswered: (id: string) => void
  /** Screen point of the selected orb — the popup floats beside it. */
  anchor: SheetAnchor
}

type Mode = 'view' | 'edit' | 'answer'

export function PrayerSheet({ prayerId, onClose, onPrayed, onAnswered, anchor }: Props) {
  const prayer = useVesper((s) => s.prayers.find((p) => p.id === prayerId))
  const canvases = useVesper((s) => s.canvases)
  const {
    pray,
    updatePrayer,
    addJournal,
    removeJournal,
    toggleJournalAnswered,
    markAnswered,
    reopen,
    removePrayer,
  } = useVesper.getState()

  const [mode, setMode] = useState<Mode>('view')
  const [title, setTitle] = useState(prayer?.title ?? '')
  const [description, setDescription] = useState(prayer?.description ?? '')
  const [canvasId, setCanvasId] = useState(prayer?.canvasId ?? '')
  const [kind, setKind] = useState<PrayerKind>(prayer?.kind ?? 'request')
  const [note, setNote] = useState('')
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalText, setJournalText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [prayed, setPrayed] = useState(false)

  if (!prayer) return null

  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    updatePrayer(prayer.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      kind,
      ...(canvasId && canvasId !== prayer.canvasId ? { canvasId } : {}),
    })
    setMode('view')
  }

  if (mode === 'edit') {
    return (
      <Sheet title="Edit prayer" onClose={onClose} anchor={anchor}>
        <form className="form" onSubmit={saveEdit}>
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
            <span>Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>
              Details <em>(optional)</em>
            </span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
          <div className="row">
            <button className="btn btn--primary" type="submit" disabled={!title.trim()}>
              Save
            </button>
            <button className="btn" type="button" onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </form>
      </Sheet>
    )
  }

  if (mode === 'answer') {
    return (
      <Sheet title={prayer.title} onClose={onClose} anchor={anchor}>
        {(close) => (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              markAnswered(prayer.id, note)
              onAnswered(prayer.id)
              close()
            }}
          >
            <label className="field">
              <span>
                How was this prayer answered? <em>(optional)</em>
              </span>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="A few words to remember this by"
              />
            </label>
            <div className="row">
              <button className="btn btn--primary" type="submit">
                Mark as answered
              </button>
              <button className="btn" type="button" onClick={() => setMode('view')}>
                Back
              </button>
            </div>
          </form>
        )}
      </Sheet>
    )
  }

  const lastPrayed = prayer.prayedAt[prayer.prayedAt.length - 1]
  const prayedToday = prayer.prayedAt.length > 0 && isSameDay(lastPrayed, Date.now())

  return (
    <Sheet title={prayer.title} onClose={onClose} anchor={anchor}>
      {(close) => {
        const handleAmen = () => {
          if (prayed) return
          pray(prayer.id)
          onPrayed(prayer.id)
          setPrayed(true)
          window.setTimeout(close, 700)
        }

        const handleDelete = () => {
          if (!confirmDelete) {
            setConfirmDelete(true)
            return
          }
          removePrayer(prayer.id)
          close()
        }

        return (
          <>
            {prayer.description && <p className="prayer__desc">{prayer.description}</p>}

            <p className="prayer__meta">
              {prayer.prayedAt.length > 0
                ? `Prayed ${prayer.prayedAt.length} time${prayer.prayedAt.length === 1 ? '' : 's'} · last ${timeAgo(lastPrayed)}`
                : 'Not prayed for yet'}
              <br />
              Carried since {longDate(prayer.createdAt)}
              {canvases.length > 1
                ? ` · ${canvases.find((c) => c.id === prayer.canvasId)?.name ?? ''}`
                : ''}
            </p>

            {prayedToday && prayer.status !== 'answered' && (
              <p className="prayer__today">✓ Prayed today</p>
            )}

            {(prayer.journal.length > 0 || journalOpen) && (
              <div className="journal">
                {prayer.journal.length > 0 && (
                  <ul className="journal__list">
                    {[...prayer.journal].reverse().map((entry) => (
                      <li key={entry.at} className={entry.answeredAt ? 'is-answered' : ''}>
                        <div className="journal__entry">
                          <time>
                            {longDate(entry.at)}
                            {entry.answeredAt ? ` · answered ${longDate(entry.answeredAt)}` : ''}
                          </time>
                          {entry.text}
                        </div>
                        <button
                          className={`icon-btn journal__mark ${entry.answeredAt ? 'is-active' : ''}`}
                          aria-label={entry.answeredAt ? 'Unmark answered' : 'Mark note answered'}
                          onClick={() => toggleJournalAnswered(prayer.id, entry.at)}
                        >
                          <StarIcon size={13} />
                        </button>
                        <button
                          className="icon-btn journal__remove"
                          aria-label="Delete note"
                          onClick={() => removeJournal(prayer.id, entry.at)}
                        >
                          <CloseIcon size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {journalOpen && (
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!journalText.trim()) return
                      addJournal(prayer.id, journalText)
                      setJournalText('')
                      setJournalOpen(false)
                    }}
                  >
                    <textarea
                      autoFocus
                      className="journal__input"
                      value={journalText}
                      onChange={(e) => setJournalText(e.target.value)}
                      rows={2}
                      placeholder="What's happening with this prayer?"
                    />
                    <div className="row">
                      <button className="btn btn--primary" type="submit" disabled={!journalText.trim()}>
                        Save note
                      </button>
                      <button className="btn" type="button" onClick={() => setJournalOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {!journalOpen && (
              <button className="journal__toggle" onClick={() => setJournalOpen(true)}>
                + Add a note
              </button>
            )}

            {prayer.status === 'answered' ? (
              <>
                <div className="answered">
                  <p className="answered__label">
                    Answered · {longDate(prayer.answeredAt ?? prayer.createdAt)}
                  </p>
                  {prayer.answeredNote && <blockquote>{prayer.answeredNote}</blockquote>}
                </div>
                <div className="row">
                  <button
                    className="btn"
                    onClick={() => {
                      reopen(prayer.id)
                      close()
                    }}
                  >
                    Return to praying
                  </button>
                  <button className="btn btn--danger" onClick={handleDelete}>
                    {confirmDelete ? 'Really delete?' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              <div className="row">
                <button className="btn btn--primary" onClick={handleAmen} disabled={prayed}>
                  Amen
                </button>
                <button className="btn" onClick={() => setMode('edit')}>
                  Edit
                </button>
                {prayer.kind !== 'person' && (
                  <button className="btn" onClick={() => setMode('answer')}>
                    Answered
                  </button>
                )}
                <button className="btn btn--danger" onClick={handleDelete}>
                  {prayer.kind === 'person'
                    ? confirmDelete
                      ? 'Really release?'
                      : 'Release'
                    : confirmDelete
                      ? 'Really delete?'
                      : 'Delete'}
                </button>
              </div>
            )}
          </>
        )
      }}
    </Sheet>
  )
}
