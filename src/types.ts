export type PrayerStatus = 'active' | 'answered'

export interface JournalEntry {
  at: number
  text: string
}

export interface Prayer {
  id: string
  title: string
  description?: string
  /** Orb hue (degrees). Gold (~46) is reserved for answered prayers. */
  hue: number
  createdAt: number
  /** Timestamps of each time this prayer was prayed for. */
  prayedAt: number[]
  /** Dated notes — the ongoing story of this prayer. */
  journal: JournalEntry[]
  status: PrayerStatus
  answeredAt?: number
  answeredNote?: string
}

export interface OrbDesign {
  size: 'small' | 'medium' | 'large'
  rings: 2 | 3 | 4
  glow: 'faint' | 'soft' | 'radiant'
  core: 'soft' | 'bold'
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  /** Days for an orb to lose half its light without prayer. */
  halfLifeDays: number
  /** How quickly orbs wander the canvas. */
  drift: 'calm' | 'lively'
  orb: OrbDesign
  showTitles: boolean
  showAnswered: boolean
  reduceMotion: boolean
  showFps: boolean
}