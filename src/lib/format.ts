const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < MIN) return 'just now'
  if (diff < HOUR) {
    const m = Math.floor(diff / MIN)
    return `${m} minute${m === 1 ? '' : 's'} ago`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = Math.floor(diff / DAY)
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function longDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
