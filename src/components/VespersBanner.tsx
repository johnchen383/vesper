import { CloseIcon } from './icons'

interface Props {
  count: number
  onBegin: () => void
  onDismiss: () => void
}

/** The gentle evening invitation: a few prayers are waiting tonight. */
export function VespersBanner({ count, onBegin, onDismiss }: Props) {
  return (
    <div className="vespers">
      <span className="vespers__text">
        Good evening. {count} prayer{count === 1 ? ' is' : 's are'} waiting.
      </span>
      <button className="btn btn--primary vespers__begin" onClick={onBegin}>
        Begin
      </button>
      <button className="icon-btn" onClick={onDismiss} aria-label="Not tonight">
        <CloseIcon size={15} />
      </button>
    </div>
  )
}
