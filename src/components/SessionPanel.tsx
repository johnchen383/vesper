import { useEffect } from 'react'
import { useVesper } from '../store/useVesper'
import { longDate, timeAgo } from '../lib/format'
import { CloseIcon } from './icons'

interface Props {
  prayerId: string
  index: number
  total: number
  onAmen: (id: string) => void
  onSkip: () => void
  onEnd: () => void
}

/** The floating card shown while praying through a session, one orb at a time. */
export function SessionPanel({ prayerId, index, total, onAmen, onSkip, onEnd }: Props) {
  const prayer = useVesper((s) => s.prayers.find((p) => p.id === prayerId))
  const canvasName = useVesper((s) =>
    s.canvases.length > 1 ? s.canvases.find((c) => c.id === prayer?.canvasId)?.name : undefined
  )

  // If the prayer disappears mid-session (deleted elsewhere), move along.
  useEffect(() => {
    if (!prayer) onSkip()
  }, [prayer, onSkip])

  if (!prayer) return null

  const lastPrayed = prayer.prayedAt[prayer.prayedAt.length - 1]

  return (
    <div className="session">
      <header className="session__header">
        <span className="session__progress">
          {index + 1} of {total}
          {canvasName ? ` · ${canvasName}` : ''}
        </span>
        <button className="icon-btn" onClick={onEnd} aria-label="End session">
          <CloseIcon size={16} />
        </button>
      </header>
      <h3 className="session__title">{prayer.title}</h3>
      {prayer.description && <p className="session__desc">{prayer.description}</p>}
      <p className="session__meta">
        {prayer.prayedAt.length > 0
          ? `Last prayed ${timeAgo(lastPrayed)}`
          : `Carried since ${longDate(prayer.createdAt)}`}
      </p>
      {prayer.journal.length > 0 && (
        <ul className="journal__list session__notes">
          {[...prayer.journal].reverse().map((entry) => (
            <li key={entry.at} className={entry.answeredAt ? 'is-answered' : ''}>
              <div className="journal__entry">
                <time>
                  {longDate(entry.at)}
                  {entry.answeredAt ? ` · answered ${longDate(entry.answeredAt)}` : ''}
                </time>
                {entry.text}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <button className="btn btn--primary" onClick={() => onAmen(prayer.id)}>
          Amen
        </button>
        <button className="btn" onClick={onSkip}>
          {index + 1 < total ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  )
}
