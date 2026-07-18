export type PrayerStatus = 'active' | 'answered'

/** A request resolves; a person is carried. People cannot be "answered". */
export type PrayerKind = 'request' | 'person'

export interface JournalEntry {
  at: number
  text: string
  /** Set when this note is highlighted — a moment worth holding onto. */
  highlightedAt?: number
}

/** A named collection of prayers; any subset can be shown on the main view. */
export interface PrayerCanvas {
  id: string
  name: string
  hue: number
  createdAt: number
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
  /** The canvas this prayer lives on. */
  canvasId: string
  kind: PrayerKind
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
  /** Gather each visible canvas into its own constellation. */
  clusterByCanvas: boolean
  showTitles: boolean
  showAnswered: boolean
  reduceMotion: boolean
  showFps: boolean
}