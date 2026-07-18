import { useEffect, useRef } from 'react'
import { OrbEngine } from './engine'
import { useVesper } from '../store/useVesper'
import { vitalityOf } from '../lib/vitality'
import { isSameDay } from '../lib/format'
import { resolveTheme } from '../lib/theme'

interface Props {
  /** 'canvas' shows living prayers; 'answered' shows the gold constellation. */
  mode: 'canvas' | 'answered'
  /** Show the example orb while the canvas is empty (post-hydration). */
  demo: boolean
  /** Orb focused by an active prayer session, if any. */
  focusId: string | null
  onSelect: (id: string) => void
  /** A meta-orb was tapped in the overview: zoom into that canvas. */
  onSelectCanvas: (canvasId: string) => void
  /** Long-press charge completed on an orb: record the prayer. */
  onLongPray: (id: string) => void
  onReady: (engine: OrbEngine) => void
}

const HOLD_DELAY_MS = 550
/** Synthetic orb ids in the meta-orb overview: one orb per canvas. */
const META_PREFIX = '__canvas:'

const DRIFT_SPEEDS = { calm: 3.2, lively: 26 }
const ORB_SIZES = { small: 17, medium: 22, large: 28 }
const ORB_GLOWS = { faint: 0.55, soft: 1, radiant: 1.6 }
const ORB_CORES = { soft: { scale: 0.3, alpha: 0 }, bold: { scale: 0.4, alpha: 0.18 } }

interface DragState {
  id: string
  startX: number
  startY: number
  dragging: boolean
  startedAt: number
}

export function OrbCanvas({
  mode,
  demo,
  focusId,
  onSelect,
  onSelectCanvas,
  onLongPray,
  onReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<OrbEngine | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const holdTimerRef = useRef(0)
  const onLongPrayRef = useRef(onLongPray)
  onLongPrayRef.current = onLongPray
  const prayers = useVesper((s) => s.prayers)
  const settings = useVesper((s) => s.settings)
  const canvases = useVesper((s) => s.canvases)
  const visibleCanvasIds = useVesper((s) => s.visibleCanvasIds)

  useEffect(() => {
    const canvas = canvasRef.current!
    const engine = new OrbEngine(canvas)
    engineRef.current = engine
    engine.onChargeComplete = (id) => {
      // Consume the gesture so releasing doesn't also count as a tap.
      dragRef.current = null
      engine.pressId = null
      onLongPrayRef.current(id)
    }
    onReady(engine)
    engine.start()

    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(canvas)
    const onVisibility = () => (document.hidden ? engine.stop() : engine.start())
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      engine.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine lives for the component's lifetime
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.reduceMotion =
      settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    engine.driftSpeed = DRIFT_SPEEDS[settings.drift] ?? DRIFT_SPEEDS.calm
    engine.showLabels = settings.showTitles
    const core = ORB_CORES[settings.orb.core]
    engine.orbStyle = {
      baseRadius: ORB_SIZES[settings.orb.size],
      rings: settings.orb.rings,
      glow: ORB_GLOWS[settings.orb.glow],
      coreScale: core.scale,
      coreAlpha: core.alpha,
    }
    engine.theme = resolveTheme(settings.theme)
    engine.debug = settings.showFps
    engine.demoMode = demo && mode === 'canvas'
    engine.focusId = focusId
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSchemeChange = () => {
      engine.theme = resolveTheme(settings.theme)
    }
    if (settings.theme === 'system') mq.addEventListener('change', onSchemeChange)

    // With more than three canvases selected, the field becomes an overview:
    // one meta-orb per canvas. Sessions need real orbs, so they override.
    const visibleCanvases = canvases.filter((c) => visibleCanvasIds.includes(c.id))
    const metaMode = mode === 'canvas' && visibleCanvases.length > 3 && !focusId

    // Visible canvases become constellation groups, in canvas-list order.
    // Empty canvases don't claim a slot — space is shared among those that
    // actually have orbs to show. Clustering can be turned off entirely in
    // settings, in which case everything shares the centre.
    const showsOrbs = (canvasId: string) =>
      prayers.some(
        (p) => p.canvasId === canvasId && (settings.showAnswered || p.status !== 'answered')
      )
    const groupOf = new Map<string, number>()
    if (settings.clusterByCanvas && !metaMode) {
      visibleCanvases
        .filter((c) => showsOrbs(c.id))
        .forEach((c, index) => groupOf.set(c.id, index))
    }
    engine.groups = mode === 'answered' || metaMode ? 1 : Math.max(1, groupOf.size)

    const sync = () => {
      const now = Date.now()

      if (metaMode) {
        engine.sync(
          visibleCanvases.map((c) => {
            const members = prayers.filter(
              (p) => p.canvasId === c.id && p.status === 'active'
            )
            const vitality =
              members.length > 0
                ? members.reduce(
                    (sum, p) => sum + vitalityOf(p, now, settings.halfLifeDays),
                    0
                  ) / members.length
                : 0.25
            return {
              id: META_PREFIX + c.id,
              label: c.name,
              hue: c.hue,
              vitality,
              answered: false,
              // The overview ring completes when the whole canvas is prayed.
              prayedToday:
                members.length > 0 &&
                members.every(
                  (p) =>
                    p.prayedAt.length > 0 &&
                    isSameDay(p.prayedAt[p.prayedAt.length - 1], now)
                ),
              weight: Math.min(40, members.length * 2.7),
              group: 0,
            }
          })
        )
        return
      }

      const visible =
        mode === 'answered'
          ? prayers.filter((p) => p.status === 'answered')
          : prayers.filter(
              (p) =>
                visibleCanvasIds.includes(p.canvasId) &&
                (settings.showAnswered || p.status !== 'answered')
            )
      engine.sync(
        visible.map((p) => ({
          id: p.id,
          label: p.title,
          hue: p.hue,
          vitality: vitalityOf(p, now, settings.halfLifeDays),
          answered: p.status === 'answered',
          prayedToday:
            p.prayedAt.length > 0 && isSameDay(p.prayedAt[p.prayedAt.length - 1], now),
          weight: p.prayedAt.length,
          group: mode === 'answered' ? 0 : (groupOf.get(p.canvasId) ?? 0),
        }))
      )
    }
    sync()
    // Vitality drifts with time even when nothing changes — refresh each minute.
    const interval = setInterval(sync, 60_000)
    return () => {
      clearInterval(interval)
      if (settings.theme === 'system') mq.removeEventListener('change', onSchemeChange)
    }
  }, [prayers, settings, mode, demo, focusId, canvases, visibleCanvasIds])

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <canvas
      ref={canvasRef}
      className="orb-canvas"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        const engine = engineRef.current
        if (!engine) return
        const { x, y } = localPoint(e)
        const id = engine.hitTest(x, y)
        if (!id) return
        e.currentTarget.setPointerCapture(e.pointerId)
        engine.pressId = id
        dragRef.current = { id, startX: x, startY: y, dragging: false, startedAt: Date.now() }
        // Held still long enough → begin the long-press prayer charge.
        // (Meta-orbs aren't prayers; they can't be charged.)
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = window.setTimeout(() => {
          const drag = dragRef.current
          if (drag && !drag.dragging && !drag.id.startsWith(META_PREFIX)) {
            engine.startCharge(drag.id)
          }
        }, HOLD_DELAY_MS)
      }}
      onPointerMove={(e) => {
        const engine = engineRef.current
        if (!engine) return
        const { x, y } = localPoint(e)
        const drag = dragRef.current
        if (!drag) {
          // Idle pointer: highlight the orb under it.
          const id = engine.hitTest(x, y)
          engine.hoverId = id
          e.currentTarget.style.cursor = id ? 'pointer' : ''
          return
        }
        // Only start moving the orb once it's clearly a drag, so a tap never nudges it.
        if (!drag.dragging && Math.hypot(x - drag.startX, y - drag.startY) > 6) {
          drag.dragging = true
          clearTimeout(holdTimerRef.current)
          engine.cancelCharge()
          engine.dragStart(drag.id, x, y)
        }
        if (drag.dragging) engine.dragMove(x, y)
      }}
      onPointerUp={(e) => {
        const engine = engineRef.current
        const drag = dragRef.current
        dragRef.current = null
        clearTimeout(holdTimerRef.current)
        if (engine) {
          engine.pressId = null
          engine.cancelCharge() // released before the charge completed
        }
        if (!drag || !engine) return
        if (drag.dragging) engine.dragEnd()
        else if (Date.now() - drag.startedAt < 500) {
          if (drag.id.startsWith(META_PREFIX)) onSelectCanvas(drag.id.slice(META_PREFIX.length))
          else onSelect(drag.id)
        }
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        const engine = engineRef.current
        clearTimeout(holdTimerRef.current)
        if (engine) {
          engine.pressId = null
          engine.cancelCharge()
        }
        if (dragRef.current?.dragging) engine?.dragEnd()
        dragRef.current = null
      }}
      onPointerLeave={() => {
        const engine = engineRef.current
        if (engine) engine.hoverId = null
      }}
    />
  )
}
