export interface OrbInput {
  id: string
  label: string
  hue: number
  vitality: number
  answered: boolean
  prayedToday: boolean
  weight: number
  /** Index of this orb's canvas among the visible ones (constellation group). */
  group: number
}

interface Orb extends OrbInput {
  x: number
  y: number
  vx: number
  vy: number
  heading: number
  phase: number
  appear: number
  pulse: number
  /** Recent positions while moving fast; drawn as a fading light streak. */
  trail: { x: number; y: number; at: number }[]
  /** 1 → 0 while playing the answered-ascension moment. */
  ascend: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  r: number
}

interface Speck {
  x: number
  y: number
  vx: number
  vy: number
  heading: number
  phase: number
  hue: number
  sat: number
  light: number
  /** Flake outline: 3-4 vertices relative to the centre. */
  verts: { x: number; y: number }[]
  rot: number
  spin: number
  /** 0.45 (far, small, slow) → 1.25 (near, bigger, livelier) parallax depth. */
  depth: number
}

/** Visual knobs for the orbs, driven by the "Orbs" section in settings. */
export interface OrbStyle {
  baseRadius: number
  rings: number
  glow: number
  coreScale: number
  coreAlpha: number
}

const TAU = Math.PI * 2
const DEMO_ID = '__demo'
const MAX_SPEED = 400
/** Cap on flick velocity so a throw never sends an orb zooming off screen. */
const THROW_MAX = 240

// Curated muted tones per hue — sat/light tuned for the warm light canvas.
const PALETTE: Record<number, { s: number; l: number }> = {
  216: { s: 42, l: 54 }, // slate blue
  8: { s: 52, l: 58 }, // terracotta
  100: { s: 26, l: 47 }, // sage
  340: { s: 38, l: 60 }, // dusty rose
  275: { s: 24, l: 55 }, // muted plum
  185: { s: 36, l: 46 }, // teal
}
const GOLD = { h: 42, s: 55, l: 48 }

function toneOf(orb: Orb): { h: number; s: number; l: number } {
  if (orb.answered) return GOLD
  const tone = PALETTE[orb.hue] ?? { s: 35, l: 52 }
  return { h: orb.hue, ...tone }
}

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Renders the living canvas: drifting, breathing orbs drawn as concentric
 * rings whose presence tracks the vitality of each prayer, among a field of
 * tiny specks that drift and get pushed around by ripples and passing orbs.
 * Orbs can be dragged and thrown, nudge each other apart, and Amen-ripples
 * push neighbours away. A soft inverted gravity pulls orbs on the fringes
 * back toward the centre while leaving the middle free to meander.
 */
export class OrbEngine {
  reduceMotion = false
  driftSpeed = 3.2
  showLabels = true
  theme: 'light' | 'dark' = 'light'
  orbStyle: OrbStyle = { baseRadius: 22, rings: 3, glow: 1, coreScale: 0.3, coreAlpha: 0 }
  /** Show a gently pulsing example orb while the canvas is empty. */
  demoMode = false
  /** Orb under the pointer / being pressed — drawn slightly lifted. */
  hoverId: string | null = null
  pressId: string | null = null
  /** During a prayer session: this orb comes to the centre, others recede. */
  focusId: string | null = null
  /** Exponential moving average of frames per second. */
  fps = 60
  /** Debug: draw a faint cross at the engine's understanding of centre. */
  showCenter = false
  /** Number of constellation groups (visible canvases). 1 = everything central. */
  groups = 1

  private groupSizes: number[] = []
  private orbCount = 0
  /** Shrinks orbs as the field gets crowded. */
  private density = 1
  /** Fired when a long-press charge completes — the caller records the prayer. */
  onChargeComplete: ((id: string) => void) | null = null
  chargeId: string | null = null

  private charge = 0
  private sparks: Spark[] = []
  private labelCache = new Map<string, string[]>()

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private orbs = new Map<string, Orb>()
  private specks: Speck[] = []
  private raf = 0
  private last = 0
  private time = 0
  private w = 0
  private h = 0
  private dpr = 1

  private dragId: string | null = null
  private dragX = 0
  private dragY = 0
  private dragVx = 0
  private dragVy = 0
  private dragLast = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
  }

  resize() {
    const prevW = this.w
    const prevH = this.h
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = this.canvas.clientWidth
    this.h = this.canvas.clientHeight
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Keep everything in proportionally the same place when the window resizes.
    if (prevW > 0 && prevH > 0 && (prevW !== this.w || prevH !== this.h)) {
      for (const orb of this.orbs.values()) {
        orb.x = (orb.x / prevW) * this.w
        orb.y = (orb.y / prevH) * this.h
      }
      for (const speck of this.specks) {
        speck.x = (speck.x / prevW) * this.w
        speck.y = (speck.y / prevH) * this.h
      }
      this.trimSpecks()
    } else {
      this.seedSpecks()
    }
  }

  sync(inputs: OrbInput[]) {
    // The very first prayer takes the demo orb's place at centre stage.
    const dropIn = this.orbs.has(DEMO_ID) && inputs.length === 1

    this.orbCount = inputs.length
    this.density = inputs.length > 30 ? Math.max(0.6, Math.sqrt(30 / inputs.length)) : 1
    this.groupSizes = []
    for (const input of inputs) {
      this.groupSizes[input.group] = (this.groupSizes[input.group] ?? 0) + 1
    }

    const ids = new Set(inputs.map((o) => o.id))
    // The demo orb is managed below, not by the inputs list.
    for (const id of this.orbs.keys()) if (!ids.has(id) && id !== DEMO_ID) this.orbs.delete(id)
    for (const input of inputs) {
      const existing = this.orbs.get(input.id)
      if (existing) {
        Object.assign(existing, input)
      } else {
        // Seed position from the id (so an orb reappears in a familiar spot)
        // scattered around its constellation's anchor.
        const seed = hash(input.id)
        const anchor = this.anchorOf(input.group)
        const spread = this.spreadOf(input.group)
        this.orbs.set(input.id, {
          ...input,
          x: dropIn ? this.w / 2 : anchor.x + ((seed % 1000) / 1000 - 0.5) * spread * 1.4,
          y: dropIn
            ? this.h * 0.28
            : anchor.y + (((seed >> 10) % 1000) / 1000 - 0.5) * spread * 1.4,
          vx: 0,
          vy: dropIn ? 30 : 0,
          heading: ((seed >> 20) % 360) * (Math.PI / 180),
          phase: (seed % 628) / 100,
          appear: 0,
          pulse: 0,
          trail: [],
          ascend: 0,
        })
      }
    }

    if (this.demoMode && inputs.length === 0) {
      if (!this.orbs.has(DEMO_ID)) {
        this.orbs.set(DEMO_ID, {
          id: DEMO_ID,
          label: '',
          hue: 275,
          vitality: 0.85,
          answered: false,
          prayedToday: true, // complete ring — the demo isn't asking anything
          weight: 6,
          group: 0,
          x: this.w / 2,
          y: this.h * 0.34,
          vx: 0,
          vy: 0,
          heading: 0,
          phase: 2,
          appear: 0,
          pulse: 0,
          trail: [],
          ascend: 0,
        })
      }
    } else {
      this.orbs.delete(DEMO_ID)
    }
  }

  /** Ripple an orb outward — played when its prayer is prayed. */
  pulse(id: string) {
    const orb = this.orbs.get(id)
    if (orb) orb.pulse = 1
  }

  /** The answered moment: still, swell gold, burst of sparks, rise a little. */
  ascend(id: string) {
    const orb = this.orbs.get(id)
    if (!orb) return
    orb.ascend = 1
    if (this.reduceMotion) return
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * TAU
      const speed = 40 + Math.random() * 110
      const life = 0.8 + Math.random() * 0.9
      this.sparks.push({
        x: orb.x,
        y: orb.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        r: 1 + Math.random() * 1.6,
      })
    }
  }

  /** Long-press charge: rings draw inward until the prayer fires. */
  startCharge(id: string) {
    this.chargeId = id
    this.charge = 0
  }

  cancelCharge() {
    this.chargeId = null
    this.charge = 0
  }

  hitTest(px: number, py: number): string | null {
    let best: string | null = null
    let bestDist = Infinity
    for (const orb of this.orbs.values()) {
      if (orb.id === DEMO_ID) continue
      const reach = this.radiusOf(orb) * 1.3 + 12
      const d = Math.hypot(px - orb.x, py - orb.y)
      if (d < reach && d < bestDist) {
        best = orb.id
        bestDist = d
      }
    }
    return best
  }

  /** Screen position and visual radius of an orb — for anchoring UI beside it. */
  orbAnchor(id: string): { x: number; y: number; r: number } | null {
    const orb = this.orbs.get(id)
    if (!orb) return null
    return { x: orb.x, y: orb.y, r: this.radiusOf(orb) * 1.5 }
  }

  dragStart(id: string, x: number, y: number) {
    this.dragId = id
    this.dragX = x
    this.dragY = y
    this.dragVx = 0
    this.dragVy = 0
    this.dragLast = performance.now()
  }

  dragMove(x: number, y: number) {
    const now = performance.now()
    const dt = Math.max((now - this.dragLast) / 1000, 1e-3)
    // Smooth the sampled pointer velocity so throws aren't jittery.
    this.dragVx = this.dragVx * 0.5 + ((x - this.dragX) / dt) * 0.5
    this.dragVy = this.dragVy * 0.5 + ((y - this.dragY) / dt) * 0.5
    this.dragX = x
    this.dragY = y
    this.dragLast = now
  }

  dragEnd() {
    const orb = this.dragId ? this.orbs.get(this.dragId) : null
    if (orb) {
      const speed = Math.hypot(this.dragVx, this.dragVy)
      const scale = speed > THROW_MAX ? THROW_MAX / speed : 1
      orb.vx = this.dragVx * scale
      orb.vy = this.dragVy * scale
    }
    this.dragId = null
  }

  start() {
    if (this.raf) return
    this.last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - this.last) / 1000, 0.05)
      this.last = now
      this.time += dt
      if (dt > 0) this.fps = this.fps * 0.92 + (1 / dt) * 0.08
      this.step(dt)
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private targetSpeckCount(): number {
    return Math.round((this.w * this.h) / 9000)
  }

  private makeSpeck(): Speck {
    // Skewed toward tiny, with the occasional larger flake; scaled by depth
    // below so nearer flakes read larger.
    const depthScale = 0.45 + Math.random() * 0.8
    const size = (1.1 + Math.random() ** 2 * 2.6) * depthScale
    const sides = Math.random() < 0.5 ? 3 : 4
    const verts = []
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * TAU + (Math.random() - 0.5) * 0.7
      const rad = size * (0.55 + Math.random() * 0.75)
      verts.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad })
    }
    return {
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      vx: 0,
      vy: 0,
      heading: Math.random() * TAU,
      phase: Math.random() * TAU,
      // Warm earthy range — ochres, olives, umbers.
      hue: 25 + Math.random() * 70,
      sat: 14 + Math.random() * 26,
      light: 13 + Math.random() * 16,
      verts,
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 0.8,
      depth: depthScale,
    }
  }

  private seedSpecks() {
    this.specks = []
    this.trimSpecks()
  }

  private trimSpecks() {
    const count = this.targetSpeckCount()
    while (this.specks.length > count) this.specks.pop()
    while (this.specks.length < count) this.specks.push(this.makeSpeck())
  }

  private radiusOf(orb: Orb): number {
    const weight = Math.min(orb.weight, 40)
    return (this.orbStyle.baseRadius + 10 * (weight / 40) + (orb.answered ? 2 : 0)) * this.density
  }

  /** Anchor point for a constellation group, arranged on an ellipse. */
  private anchorOf(group: number): { x: number; y: number } {
    if (this.groups <= 1) return { x: this.w / 2, y: this.h / 2 }
    const angle = -Math.PI / 2 + (group / this.groups) * TAU
    return {
      x: this.w / 2 + Math.cos(angle) * this.w * 0.27,
      y: this.h / 2 + Math.sin(angle) * this.h * 0.25,
    }
  }

  /** How far a group's members comfortably spread around their anchor. */
  private spreadOf(group: number): number {
    if (this.groups <= 1) return Math.min(this.w, this.h) * 0.5 || 1
    const count = this.groupSizes[group] ?? 1
    return Math.min(90 + 26 * Math.sqrt(count), Math.min(this.w, this.h) * 0.3)
  }

  private step(dt: number) {
    const drift = this.reduceMotion ? 0 : this.driftSpeed
    const orbs = [...this.orbs.values()]
    const cx = this.w / 2
    const cy = this.h / 2

    for (const orb of orbs) {
      orb.appear = Math.min(1, orb.appear + dt / 0.9)
      orb.pulse = Math.max(0, orb.pulse - dt / 2.6)

      // The demo orb floats in place and ripples now and then to show how.
      if (orb.id === DEMO_ID) {
        orb.x += (this.w / 2 - orb.x) * Math.min(1, dt * 1.2)
        orb.y += (this.h * 0.34 - orb.y) * Math.min(1, dt * 1.2)
        if (!this.reduceMotion && this.time % 6 < dt) orb.pulse = 1
        continue
      }

      // Ascension: the orb stills and swells gold in place.
      if (orb.ascend > 0) {
        if (this.reduceMotion) {
          orb.ascend = 0
        } else {
          orb.ascend = Math.max(0, orb.ascend - dt / 2.4)
          orb.vx *= 0.9
          orb.vy *= 0.9
          continue
        }
      }

      // A focused orb (prayer session) is drawn to the centre and stills.
      if (orb.id === this.focusId) {
        const k = Math.min(1, dt * 1.6)
        orb.x += (cx - orb.x) * k
        orb.y += (cy - orb.y) * k
        orb.vx = 0
        orb.vy = 0
        continue
      }

      if (orb.id === this.dragId) {
        // Follow the pointer with a touch of lag so it feels weighty.
        const k = Math.min(1, dt * 18)
        orb.x += (this.dragX - orb.x) * k
        orb.y += (this.dragY - orb.y) * k
        orb.vx = (this.dragX - orb.x) * 4
        orb.vy = (this.dragY - orb.y) * 4
        continue
      }

      // Wandering: velocity eases toward a slowly turning drift direction,
      // which also damps out throws and ripple shoves over ~1.5s.
      orb.heading += (Math.random() - 0.5) * 0.7 * dt
      const steer = Math.min(1, dt * 0.7)
      orb.vx += (Math.cos(orb.heading) * drift - orb.vx) * steer
      orb.vy += (Math.sin(orb.heading) * drift - orb.vy) * steer

      // Anchor gravity: each orb is pulled toward its constellation's anchor
      // (screen centre when one canvas is shown). The pull has real strength
      // in the mid-range, so clusters gather around their anchor instead of
      // settling wherever they were seeded, while staying gentle enough
      // near the anchor to meander. Prayers still waiting on today's prayer
      // feel an extra homeward pull.
      if (!this.reduceMotion) {
        const anchor = this.anchorOf(orb.group)
        const spread = this.spreadOf(orb.group)
        const dx = anchor.x - orb.x
        const dy = anchor.y - orb.y
        const d = Math.hypot(dx, dy)
        if (d > 1) {
          const waiting = !orb.answered && !orb.prayedToday
          const a = Math.min(
            160,
            30 * (d / spread) ** 1.8 + (waiting ? 12 * (d / spread) : 0)
          )
          orb.vx += (dx / d) * a * dt
          orb.vy += (dy / d) * a * dt
        }
      }

      const speed = Math.hypot(orb.vx, orb.vy)
      if (speed > MAX_SPEED) {
        orb.vx *= MAX_SPEED / speed
        orb.vy *= MAX_SPEED / speed
      }
      orb.x += orb.vx * dt
      orb.y += orb.vy * dt

      // Wrap as a backstop: a hard throw exits one side, returns opposite.
      const pad = this.radiusOf(orb) * 2.8
      if (orb.x < -pad) orb.x += this.w + 2 * pad
      if (orb.x > this.w + pad) orb.x -= this.w + 2 * pad
      if (orb.y < -pad) orb.y += this.h + 2 * pad
      if (orb.y > this.h + pad) orb.y -= this.h + 2 * pad
    }

    // Personal space and collisions between orbs.
    for (let i = 0; i < orbs.length; i++) {
      for (let j = i + 1; j < orbs.length; j++) {
        const a = orbs[i]
        const b = orbs[j]
        const radii = this.radiusOf(a) + this.radiusOf(b)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        const ux = dx / d
        const uy = dy / d

        // Long-range personal space: a gentle preference for openness.
        const space = radii * 2.3
        if (d < space) {
          const soft = 30 * (1 - d / space) ** 2 * dt
          if (a.id !== this.dragId && a.id !== this.focusId) {
            a.vx -= ux * soft
            a.vy -= uy * soft
          }
          if (b.id !== this.dragId && b.id !== this.focusId) {
            b.vx += ux * soft
            b.vy += uy * soft
          }
        }

        // Hard overlap: shove firmly apart.
        const min = radii * 0.85 + 16
        if (d >= min) continue
        const overlap = (min - d) / min
        const impulse = 260 * overlap * dt
        const separate = 40 * overlap * dt
        if (a.id !== this.dragId && a.id !== this.focusId) {
          a.vx -= ux * impulse
          a.vy -= uy * impulse
          a.x -= ux * separate
          a.y -= uy * separate
        }
        if (b.id !== this.dragId && b.id !== this.focusId) {
          b.vx += ux * impulse
          b.vy += uy * impulse
          b.x += ux * separate
          b.y += uy * separate
        }
      }
    }

    // Trails: fast-moving orbs leave a streak of light behind them.
    for (const orb of orbs) {
      while (orb.trail.length && this.time - orb.trail[0].at > 0.8) orb.trail.shift()
      if (this.reduceMotion) {
        orb.trail.length = 0
        continue
      }
      if (Math.hypot(orb.vx, orb.vy) > 70) {
        orb.trail.push({ x: orb.x, y: orb.y, at: this.time })
        if (orb.trail.length > 24) orb.trail.shift()
      }
    }

    // Long-press charge: fill up, then fire the prayer.
    if (this.chargeId) {
      if (!this.orbs.has(this.chargeId)) {
        this.cancelCharge()
      } else {
        this.charge = Math.min(1, this.charge + dt / 0.9)
        if (this.charge >= 1) {
          const id = this.chargeId
          this.cancelCharge()
          this.onChargeComplete?.(id)
        }
      }
    }

    // Ascension sparks.
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0)
    for (const s of this.sparks) {
      s.x += s.vx * dt
      s.y += s.vy * dt
      const damp = Math.exp(-dt * 1.8)
      s.vx *= damp
      s.vy *= damp
    }

    // Amen ripples push neighbours as the wavefront sweeps past them.
    for (const source of orbs) {
      if (source.pulse <= 0) continue
      const p = (1 - source.pulse) * 1.35
      if (p >= 1) continue
      const front = this.radiusOf(source) * (1.15 + 3.4 * p)
      const band = 80
      for (const other of orbs) {
        if (other === source || other.id === this.dragId || other.id === this.focusId) continue
        const dx = other.x - source.x
        const dy = other.y - source.y
        const d = Math.hypot(dx, dy) || 1
        const hit = 1 - Math.abs(d - front) / band
        if (hit <= 0) continue
        const push = 320 * hit * (1 - p) * dt
        other.vx += (dx / d) * push
        other.vy += (dy / d) * push
      }
    }

    this.stepSpecks(dt, orbs)
  }

  private stepSpecks(dt: number, orbs: Orb[]) {
    if (this.reduceMotion) return
    for (const speck of this.specks) {
      speck.rot += speck.spin * dt
      // Idle wander, a little quicker in turn than the orbs. Nearer specks
      // (higher depth) drift faster and react harder — parallax.
      speck.heading += (Math.random() - 0.5) * 1.2 * dt
      const steer = Math.min(1, dt * 0.9)
      speck.vx += (Math.cos(speck.heading) * 6 * speck.depth - speck.vx) * steer
      speck.vy += (Math.sin(speck.heading) * 6 * speck.depth - speck.vy) * steer

      for (const orb of orbs) {
        const R = this.radiusOf(orb)
        const dx = speck.x - orb.x
        const dy = speck.y - orb.y
        const d = Math.hypot(dx, dy) || 1

        // Passing (or dragged) orbs plough specks aside.
        const reach = R * 1.8
        if (d < reach) {
          const orbSpeed = Math.hypot(orb.vx, orb.vy)
          const push = (18 + orbSpeed * 0.5) * (1 - d / reach) * speck.depth * dt
          speck.vx += (dx / d) * push
          speck.vy += (dy / d) * push
        }

        // Amen wavefronts carry specks with them.
        if (orb.pulse > 0) {
          const p = (1 - orb.pulse) * 1.35
          if (p < 1) {
            const front = R * (1.15 + 3.4 * p)
            const hit = 1 - Math.abs(d - front) / 60
            if (hit > 0) {
              const push = 500 * hit * (1 - p) * speck.depth * dt
              speck.vx += (dx / d) * push
              speck.vy += (dy / d) * push
            }
          }
        }
      }

      const speed = Math.hypot(speck.vx, speck.vy)
      if (speed > MAX_SPEED) {
        speck.vx *= MAX_SPEED / speed
        speck.vy *= MAX_SPEED / speed
      }
      speck.x += speck.vx * dt
      speck.y += speck.vy * dt

      const pad = 16
      if (speck.x < -pad) speck.x += this.w + 2 * pad
      if (speck.x > this.w + pad) speck.x -= this.w + 2 * pad
      if (speck.y < -pad) speck.y += this.h + 2 * pad
      if (speck.y > this.h + pad) speck.y -= this.h + 2 * pad
    }
  }

  private draw() {
    const { ctx } = this
    ctx.clearRect(0, 0, this.w, this.h)

    const dark = this.theme === 'dark'
    for (const speck of this.specks) {
      const twinkle = this.reduceMotion
        ? 0.6
        : 0.5 + 0.3 * Math.sin(this.time * 0.7 + speck.phase)
      // Farther flakes fade back — depth.
      ctx.globalAlpha = (dark ? 0.45 : 0.6) * twinkle * (0.45 + 0.55 * Math.min(1, speck.depth))
      // Dark theme flips flakes pale-ish so they read against the night canvas.
      const light = dark ? 76 - speck.light : speck.light
      ctx.fillStyle = `hsl(${speck.hue}, ${speck.sat}%, ${light}%)`
      const cos = Math.cos(speck.rot)
      const sin = Math.sin(speck.rot)
      ctx.beginPath()
      speck.verts.forEach((v, i) => {
        const x = speck.x + v.x * cos - v.y * sin
        const y = speck.y + v.x * sin + v.y * cos
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1

    for (const orb of this.orbs.values()) this.drawTrail(orb)
    for (const orb of this.orbs.values()) this.drawOrb(orb)
    this.drawSparks()

    if (this.showCenter) {
      const cx = this.w / 2
      const cy = this.h / 2
      ctx.strokeStyle = dark ? 'rgba(234,232,242,0.4)' : 'rgba(53,50,44,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - 14, cy)
      ctx.lineTo(cx + 14, cy)
      ctx.moveTo(cx, cy - 14)
      ctx.lineTo(cx, cy + 14)
      ctx.stroke()
    }
  }

  /** A comet-shaped wake: widest at the orb, tapering to a point at the tail. */
  private drawTrail(orb: Orb) {
    const trail = orb.trail
    if (trail.length < 2) return
    // Use only the newest contiguous run — a wrap teleport or expired points
    // would otherwise streak across the canvas.
    let start = trail.length - 1
    while (start > 0) {
      const p0 = trail[start - 1]
      const p1 = trail[start]
      if (this.time - p0.at > 0.8) break
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 200) break
      start--
    }
    const pts = trail.slice(start)
    if (pts.length < 2) return

    const left: { x: number; y: number }[] = []
    const right: { x: number; y: number }[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const nx = -(b.y - a.y) / len
      const ny = (b.x - a.x) / len
      const fade = Math.max(0, 1 - (this.time - pts[i].at) / 0.8)
      const halfW = 3 * fade * fade
      left.push({ x: pts[i].x + nx * halfW, y: pts[i].y + ny * halfW })
      right.push({ x: pts[i].x - nx * halfW, y: pts[i].y - ny * halfW })
    }

    const { ctx } = this
    const { h, s, l } = toneOf(orb)
    const light = this.theme === 'dark' ? l + 18 : l
    ctx.fillStyle = `hsla(${h}, ${s}%, ${light}%, 0.2)`
    ctx.beginPath()
    ctx.moveTo(left[0].x, left[0].y)
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y)
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y)
    ctx.closePath()
    ctx.fill()
  }

  private drawSparks() {
    const { ctx } = this
    ctx.fillStyle = this.theme === 'dark' ? 'hsl(46, 80%, 72%)' : 'hsl(44, 70%, 50%)'
    for (const spark of this.sparks) {
      const life = spark.life / spark.maxLife
      ctx.globalAlpha = life * life * 0.9
      ctx.beginPath()
      ctx.arc(spark.x, spark.y, spark.r * (0.5 + 0.5 * life), 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawOrb(orb: Orb) {
    const { ctx } = this
    const focused = this.focusId === orb.id
    // During a session everything but the focused orb recedes.
    const recede = this.focusId && !focused ? 0.3 : 1
    // Hovered or pressed orbs lift slightly toward the eye.
    const lift =
      (this.hoverId === orb.id ? 0.14 : 0) + (this.pressId === orb.id ? 0.1 : 0)
    const appear = (1 - (1 - orb.appear) ** 3) * recede
    // Focused orbs breathe slower and deeper — a pace to pray by.
    const breathe = this.reduceMotion
      ? 1
      : focused
        ? 1 + 0.07 * Math.sin(this.time * 0.45)
        : 1 + 0.04 * Math.sin(this.time * 0.6 + orb.phase)
    const pulseEase = orb.pulse ** 2
    // Ascension swell: one slow rise-and-settle as the orb turns gold.
    const ascent =
      orb.ascend > 0 ? Math.sin(Math.PI * Math.min(1, (1 - orb.ascend) * 1.5)) : 0
    const R = this.radiusOf(orb) * appear * breathe * (1 + 0.04 * lift + 0.28 * ascent)
    if (R <= 0.5) return

    const vit = orb.vitality
    const dark = this.theme === 'dark'
    const { h, s: baseS, l: baseL } = toneOf(orb)
    // Fading prayers wash toward the background: toward the paper when light,
    // into the night when dark. Dark tones run notably brighter and richer.
    const s = Math.min(100, baseS * (0.45 + 0.55 * vit) * (dark ? 1.4 : 1))
    const l = dark ? baseL + 22 - (1 - vit) * 6 : baseL + (1 - vit) * 14
    const presence = (0.3 + 0.7 * vit) * appear

    // Heartbeat: a slow periodic swell, stronger the more alive the prayer is.
    const beat = this.reduceMotion
      ? 0
      : Math.max(0, Math.sin(this.time * 1.6 + orb.phase)) ** 4 * vit

    // A whisper of a halo behind the rings, breathing with the heartbeat.
    const glowR = R * (1.8 + 0.25 * beat)
    const charging = this.chargeId === orb.id ? this.charge : 0
    const haloAlpha =
      Math.min(
        0.7,
        (0.08 +
          0.14 * vit +
          0.2 * pulseEase +
          0.12 * beat +
          lift * 0.6 +
          (focused ? 0.08 : 0) +
          0.25 * ascent +
          0.18 * charging) *
          this.orbStyle.glow
      ) * appear
    const halo = ctx.createRadialGradient(orb.x, orb.y, R * 0.2, orb.x, orb.y, glowR)
    halo.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${haloAlpha})`)
    halo.addColorStop(0.5, `hsla(${h}, ${s}%, ${l}%, ${haloAlpha * 0.35})`)
    halo.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`)
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(orb.x, orb.y, glowR, 0, TAU)
    ctx.fill()

    // Concentric rings, evenly spread from the core outward, fainter as they
    // widen. The outermost ring is left subtly broken until the prayer has
    // been prayed today — praying completes the circle.
    const ringCount = this.orbStyle.rings
    for (let i = 0; i < ringCount; i++) {
      const t = ringCount === 1 ? 0.5 : i / (ringCount - 1)
      const factor = 0.5 + 0.56 * t
      const outermost = i === ringCount - 1
      const completed = orb.answered || orb.prayedToday
      let ringAlpha = 0.55 - 0.39 * t
      if (outermost && completed && !orb.answered) ringAlpha += 0.18
      if (outermost && !completed) {
        ctx.setLineDash([7, 6])
        ctx.lineDashOffset = orb.phase * 10
      }
      ctx.strokeStyle = `hsla(${h}, ${s}%, ${l - 6}%, ${ringAlpha * presence + 0.25 * pulseEase})`
      ctx.lineWidth = 1.5 - 0.6 * t + (outermost && completed && !orb.answered ? 0.3 : 0)
      ctx.beginPath()
      ctx.arc(orb.x, orb.y, R * factor, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // A faint ripple continuously emanating from the core keeps the orb alive.
    if (!this.reduceMotion) {
      const cycle = 5 - 2.5 * vit // livelier prayers ripple a touch faster
      const p = (this.time / cycle + orb.phase / TAU) % 1
      const rippleAlpha = 0.2 * presence * (1 - p) * Math.min(1, p * 8)
      if (rippleAlpha > 0.005) {
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${l - 6}%, ${rippleAlpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, R * (0.55 + 0.95 * p), 0, TAU)
        ctx.stroke()
      }
    }

    // Feathered core dot, swelling slightly with each heartbeat.
    const coreBoost = this.orbStyle.coreAlpha
    const coreR = R * (this.orbStyle.coreScale + 0.06 * pulseEase + 0.035 * beat)
    const core = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, coreR)
    core.addColorStop(
      0,
      `hsla(${h}, ${s}%, ${l}%, ${Math.min(1, 0.55 + coreBoost + 0.4 * vit + 0.1 * beat) * appear})`
    )
    core.addColorStop(
      0.65,
      `hsla(${h}, ${s}%, ${l}%, ${Math.min(1, 0.4 + coreBoost + 0.35 * vit) * appear})`
    )
    core.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`)
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(orb.x, orb.y, coreR, 0, TAU)
    ctx.fill()

    // Long-press charge: a ring draws inward until the prayer fires.
    if (charging > 0) {
      ctx.strokeStyle = `hsla(${h}, ${s}%, ${l - 6}%, ${0.2 + 0.4 * charging})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(orb.x, orb.y, R * (1.7 - 1.05 * charging), 0, TAU)
      ctx.stroke()
    }

    // Answered prayers carry an extra quiet gold ring — a seal of faithfulness.
    if (orb.answered) {
      ctx.strokeStyle = `hsla(${GOLD.h}, 60%, ${dark ? 62 : 40}%, ${0.4 * appear})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(orb.x, orb.y, R * 1.3, 0, TAU)
      ctx.stroke()
    }


    // Amen ripples: three staggered rings spreading like water.
    if (orb.pulse > 0) {
      const t = 1 - orb.pulse
      for (let k = 0; k < 3; k++) {
        const p = t * 1.35 - k * 0.16
        if (p <= 0 || p >= 1) continue
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${Math.max(20, l - 18)}%, ${0.4 * (1 - p) ** 2 * appear})`
        ctx.lineWidth = 2.2 * (1 - p) + 0.6
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, R * (1.15 + 3.4 * p), 0, TAU)
        ctx.stroke()
      }
    }

    // In a crowded field, keep labels only where attention is: prayers still
    // waiting on today, and whatever is hovered or focused.
    const labelVisible =
      this.showLabels &&
      orb.label &&
      (this.orbCount <= 40 ||
        (!orb.prayedToday && !orb.answered) ||
        this.hoverId === orb.id ||
        focused)
    if (labelVisible) {
      ctx.font = LABEL_FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const ink = dark ? '247, 245, 252' : '53, 50, 44'
      ctx.fillStyle = `rgba(${ink}, ${(dark ? 0.8 : 0.55) * appear * (0.55 + 0.45 * vit)})`
      const lines = this.wrapLabel(orb.label)
      const baseY = orb.y + R * 1.3 + 8
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], orb.x, baseY + i * 15)
      }
    }
  }

  /** Break a label into at most two lines, ellipsised if it still overflows. */
  private wrapLabel(label: string): string[] {
    // Labels stay in proportion to the orbs they sit under.
    const maxW = Math.max(96, this.orbStyle.baseRadius * 4.6)
    const key = `${maxW}:${label}`
    const cached = this.labelCache.get(key)
    if (cached) return cached
    const { ctx } = this
    ctx.font = LABEL_FONT
    const lines: string[] = []
    let rest = label.trim()
    for (let li = 0; li < 2 && rest; li++) {
      if (ctx.measureText(rest).width <= maxW) {
        lines.push(rest)
        rest = ''
        break
      }
      const words = rest.split(' ')
      let line = words[0]
      let n = 1
      while (n < words.length && ctx.measureText(`${line} ${words[n]}`).width <= maxW) {
        line = `${line} ${words[n]}`
        n++
      }
      lines.push(line)
      rest = words.slice(n).join(' ')
    }
    let last = lines[lines.length - 1]
    if (rest || ctx.measureText(last).width > maxW) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) {
        last = last.slice(0, -1)
      }
      lines[lines.length - 1] = `${last.trimEnd()}…`
    }
    if (this.labelCache.size > 500) this.labelCache.clear()
    this.labelCache.set(key, lines)
    return lines
  }
}

const LABEL_FONT = '500 12px Inter, system-ui, sans-serif'
