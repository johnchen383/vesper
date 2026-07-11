import { useEffect, useRef, useState } from 'react'
import { resolveTheme } from './lib/theme'
import { isSameDay } from './lib/format'
import { OrbCanvas } from './canvas/OrbCanvas'
import type { OrbEngine } from './canvas/engine'
import { Fab } from './components/Fab'
import { AddPrayerSheet } from './components/AddPrayerSheet'
import { PrayerSheet } from './components/PrayerSheet'
import { SettingsSheet } from './components/SettingsSheet'
import { AboutSheet } from './components/AboutSheet'
import { CanvasesSheet } from './components/CanvasesSheet'
import { EmptyState } from './components/EmptyState'
import { SessionPanel } from './components/SessionPanel'
import { VespersBanner } from './components/VespersBanner'
import { FpsMeter } from './components/FpsMeter'
import { CloseIcon } from './components/icons'
import { useHydrated, useVesper } from './store/useVesper'
import type { Prayer } from './types'

type Panel =
  | { kind: 'add' }
  | { kind: 'settings' }
  | { kind: 'about' }
  | { kind: 'canvases' }
  | { kind: 'prayer'; id: string; anchor: { x: number; y: number; r: number } }
  | null

interface Session {
  queue: string[]
  index: number
}

const VESPERS_KEY = 'vesper:vespers-dismissed'

/** Active prayers on visible canvases not yet prayed for today, oldest-prayed first. */
function sessionQueue(prayers: Prayer[], visibleCanvasIds: string[]): string[] {
  const now = Date.now()
  const lastOf = (p: Prayer) => p.prayedAt[p.prayedAt.length - 1] ?? p.createdAt
  return prayers
    .filter(
      (p) =>
        p.status === 'active' &&
        visibleCanvasIds.includes(p.canvasId) &&
        !(p.prayedAt.length > 0 && isSameDay(lastOf(p), now))
    )
    .sort((a, b) => lastOf(a) - lastOf(b))
    .map((p) => p.id)
}

export default function App() {
  const engineRef = useRef<OrbEngine | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [view, setView] = useState<'canvas' | 'answered'>('canvas')
  const [session, setSession] = useState<Session | null>(null)
  const [vespersDismissed, setVespersDismissed] = useState(
    () => localStorage.getItem(VESPERS_KEY) === new Date().toDateString()
  )
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null)
  const toastTimer = useRef(0)
  const hydrated = useHydrated()
  const prayers = useVesper((s) => s.prayers)
  const canvases = useVesper((s) => s.canvases)
  const visibleCanvasIds = useVesper((s) => s.visibleCanvasIds)
  const pray = useVesper((s) => s.pray)
  const theme = useVesper((s) => s.settings.theme)
  const showFps = useVesper((s) => s.settings.showFps)
  const showAnswered = useVesper((s) => s.settings.showAnswered)

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme)
      document.documentElement.dataset.theme = resolved
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'dark' ? '#14122a' : '#f7f4ee')
    }
    apply()
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const answeredCount = prayers.filter((p) => p.status === 'answered').length
  const waitingCount = sessionQueue(prayers, visibleCanvasIds).length

  const visibleCanvases = canvases.filter((c) => visibleCanvasIds.includes(c.id))
  const visibleOrbCount = prayers.filter(
    (p) =>
      visibleCanvasIds.includes(p.canvasId) && (showAnswered || p.status !== 'answered')
  ).length
  const canvasBarLabel =
    visibleCanvases.length === canvases.length
      ? 'All canvases'
      : visibleCanvases.length === 1
        ? visibleCanvases[0].name
        : `${visibleCanvases[0]?.name ?? 'Canvases'} +${visibleCanvases.length - 1}`

  const startSession = () => {
    const queue = sessionQueue(prayers, visibleCanvasIds)
    if (!queue.length) return
    setPanel(null)
    setView('canvas')
    setSession({ queue, index: 0 })
  }

  const advanceSession = () =>
    setSession((s) => (s && s.index + 1 < s.queue.length ? { ...s, index: s.index + 1 } : null))

  const showToast = (text: string) => {
    clearTimeout(toastTimer.current)
    setToast({ key: Date.now(), text })
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }

  const dismissVespers = () => {
    localStorage.setItem(VESPERS_KEY, new Date().toDateString())
    setVespersDismissed(true)
  }

  const showVespers =
    hydrated &&
    !vespersDismissed &&
    !session &&
    view === 'canvas' &&
    new Date().getHours() >= 17 &&
    waitingCount > 0

  return (
    <>
      <OrbCanvas
        mode={view}
        demo={hydrated && prayers.length === 0}
        focusId={session ? session.queue[session.index] : null}
        onReady={(engine) => {
          engineRef.current = engine
        }}
        onSelect={(id) => {
          // The popup floats beside the orb, leaving it and its ripples visible.
          const anchor = engineRef.current?.orbAnchor(id) ?? {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            r: 0,
          }
          setPanel({ kind: 'prayer', id, anchor })
        }}
        onLongPray={(id) => {
          pray(id)
          engineRef.current?.pulse(id)
          const prayer = prayers.find((p) => p.id === id)
          showToast(`Amen · prayed for ${prayer?.title ?? 'this prayer'}`)
        }}
      />

      {hydrated && prayers.length === 0 && <EmptyState />}
      {hydrated && prayers.length > 0 && view === 'canvas' && visibleOrbCount === 0 && (
        <div className="empty">
          <p className="empty__sub">Nothing on this canvas yet. Add a prayer with +.</p>
        </div>
      )}

      {showVespers && (
        <VespersBanner count={waitingCount} onBegin={startSession} onDismiss={dismissVespers} />
      )}

      {canvases.length > 1 && view === 'canvas' && !session && (
        <button className="canvasbar" onClick={() => setPanel({ kind: 'canvases' })}>
          {canvasBarLabel}
        </button>
      )}

      {view === 'answered' && (
        <div className="viewbar">
          <span>
            Answered · {answeredCount} prayer{answeredCount === 1 ? '' : 's'}
          </span>
          <button className="icon-btn" onClick={() => setView('canvas')} aria-label="Back">
            <CloseIcon size={15} />
          </button>
        </div>
      )}
      {view === 'answered' && answeredCount === 0 && (
        <div className="empty">
          <p className="empty__sub">No answered prayers yet. They will gather here.</p>
        </div>
      )}

      {!session && view === 'canvas' && (
        <Fab
          onAdd={() => setPanel({ kind: 'add' })}
          onPray={waitingCount > 0 ? startSession : undefined}
          onCanvases={() => setPanel({ kind: 'canvases' })}
          onAnswered={answeredCount > 0 ? () => setView('answered') : undefined}
          onSettings={() => setPanel({ kind: 'settings' })}
        />
      )}

      {session && (
        <SessionPanel
          prayerId={session.queue[session.index]}
          index={session.index}
          total={session.queue.length}
          onAmen={(id) => {
            pray(id)
            engineRef.current?.pulse(id)
            advanceSession()
          }}
          onSkip={advanceSession}
          onEnd={() => setSession(null)}
        />
      )}

      {toast && (
        <div className="toast" key={toast.key}>
          {toast.text}
        </div>
      )}

      {showFps && <FpsMeter engineRef={engineRef} />}

      {panel?.kind === 'add' && <AddPrayerSheet onClose={() => setPanel(null)} />}
      {panel?.kind === 'settings' && (
        <SettingsSheet
          onClose={() => setPanel(null)}
          onAbout={() => setPanel({ kind: 'about' })}
        />
      )}
      {panel?.kind === 'about' && <AboutSheet onClose={() => setPanel(null)} />}
      {panel?.kind === 'canvases' && <CanvasesSheet onClose={() => setPanel(null)} />}
      {panel?.kind === 'prayer' && (
        <PrayerSheet
          prayerId={panel.id}
          anchor={panel.anchor}
          onClose={() => setPanel(null)}
          onPrayed={(id) => engineRef.current?.pulse(id)}
          onAnswered={(id) => engineRef.current?.ascend(id)}
        />
      )}
    </>
  )
}
