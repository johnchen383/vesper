import type { Prayer } from '../types'

const DAY = 86_400_000

/**
 * 0..1 — how alive an orb looks.
 * Mostly driven by recency (half-life decay since the last prayer), with a
 * smaller consistency term for how often it was prayed in the last month.
 * Floored so neglected orbs dim to an ember rather than vanish — an
 * invitation to return, not a punishment.
 */
export function vitalityOf(prayer: Prayer, now: number, halfLifeDays: number): number {
  if (prayer.status === 'answered') return 1
  const last =
    prayer.prayedAt.length > 0 ? prayer.prayedAt[prayer.prayedAt.length - 1] : prayer.createdAt
  const recency = Math.pow(0.5, (now - last) / DAY / halfLifeDays)
  const recentCount = prayer.prayedAt.filter((t) => now - t < 30 * DAY).length
  const consistency = Math.min(1, recentCount / 12)
  return Math.max(0.12, 0.75 * recency + 0.25 * consistency)
}
