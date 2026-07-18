import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { JournalEntry, Prayer, PrayerCanvas, PrayerKind, Settings } from '../types'
import { localAdapter } from '../storage/adapter'

// Curated orb tones (see the engine's palette); gold is reserved for answered prayers.
const HUES = [216, 8, 100, 340, 275, 185]
const MAX_PRAYED_ENTRIES = 1000

/** A canvas holds at most this many active prayers. */
export const MAX_PER_CANVAS = 15

/** Bump when the persisted shape changes, and handle it in `migrate` below. */
const SCHEMA_VERSION = 5

interface VesperState {
  prayers: Prayer[]
  canvases: PrayerCanvas[]
  /** Canvases currently shown on the main view. Invariant: at least one. */
  visibleCanvasIds: string[]
  settings: Settings
  addPrayer: (title: string, description?: string, canvasId?: string, kind?: PrayerKind) => string
  pray: (id: string) => void
  updatePrayer: (
    id: string,
    patch: Partial<Pick<Prayer, 'title' | 'description' | 'canvasId' | 'kind'>>
  ) => void
  addJournal: (id: string, text: string) => void
  removeJournal: (id: string, at: number) => void
  toggleJournalHighlight: (id: string, at: number) => void
  markAnswered: (id: string, note?: string) => void
  reopen: (id: string) => void
  removePrayer: (id: string) => void
  addCanvas: (name: string) => string
  renameCanvas: (id: string, name: string) => void
  removeCanvas: (id: string, deletePrayers?: boolean) => void
  toggleCanvasVisible: (id: string) => void
  /** Zoom into one canvas (from the meta-orb overview). */
  showOnlyCanvas: (id: string) => void
  /** Show every canvas — the overview when more than three exist. */
  showAllCanvases: () => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (
    prayers: Prayer[],
    canvases?: PrayerCanvas[],
    settings?: Partial<Settings>
  ) => void
}

function leastUsedHue(used: { hue: number }[]): number {
  const counts = HUES.map((hue) => used.filter((u) => u.hue === hue).length)
  return HUES[counts.indexOf(Math.min(...counts))]
}

function makeCanvas(name: string, existing: PrayerCanvas[]): PrayerCanvas {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    hue: leastUsedHue(existing),
    createdAt: Date.now(),
  }
}

const initialCanvas = makeCanvas('Default', [])

export const useVesper = create<VesperState>()(
  persist(
    (set, get) => ({
      prayers: [],
      canvases: [initialCanvas],
      visibleCanvasIds: [initialCanvas.id],
      settings: {
        theme: 'light',
        halfLifeDays: 7,
        gravity: 'gentle',
        orb: { size: 'medium', rings: 3, glow: 'soft', core: 'soft' },
        clusterByCanvas: true,
        showTitles: true,
        showAnswered: true,
        reduceMotion: false,
        showFps: false,
      },

      addPrayer: (title, description, canvasId, kind = 'request') => {
        const { prayers, canvases, visibleCanvasIds } = get()
        const target =
          canvasId ??
          (visibleCanvasIds.length === 1 ? visibleCanvasIds[0] : canvases[0].id)
        const activeOnTarget = prayers.filter(
          (p) => p.canvasId === target && p.status === 'active'
        ).length
        if (activeOnTarget >= MAX_PER_CANVAS) return ''
        const prayer: Prayer = {
          id: crypto.randomUUID(),
          title: title.trim(),
          description: description?.trim() || undefined,
          hue: leastUsedHue(prayers),
          createdAt: Date.now(),
          prayedAt: [],
          journal: [],
          canvasId: target,
          kind,
          status: 'active',
        }
        set((s) => ({ prayers: [...s.prayers, prayer] }))
        return prayer.id
      },

      pray: (id) =>
        set((s) => ({
          prayers: s.prayers.map((p) =>
            p.id === id
              ? { ...p, prayedAt: [...p.prayedAt, Date.now()].slice(-MAX_PRAYED_ENTRIES) }
              : p
          ),
        })),

      updatePrayer: (id, patch) =>
        set((s) => ({
          prayers: s.prayers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      addJournal: (id, text) =>
        set((s) => ({
          prayers: s.prayers.map((p) =>
            p.id === id
              ? { ...p, journal: [...p.journal, { at: Date.now(), text: text.trim() }] }
              : p
          ),
        })),

      toggleJournalHighlight: (id, at) =>
        set((s) => ({
          prayers: s.prayers.map((p) =>
            p.id === id
              ? {
                  ...p,
                  journal: p.journal.map((e) =>
                    e.at === at
                      ? { ...e, highlightedAt: e.highlightedAt ? undefined : Date.now() }
                      : e
                  ),
                }
              : p
          ),
        })),

      removeJournal: (id, at) =>
        set((s) => ({
          prayers: s.prayers.map((p) =>
            p.id === id ? { ...p, journal: p.journal.filter((e) => e.at !== at) } : p
          ),
        })),

      markAnswered: (id, note) =>
        set((s) => ({
          prayers: s.prayers.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: 'answered' as const,
                  answeredAt: Date.now(),
                  answeredNote: note?.trim() || undefined,
                }
              : p
          ),
        })),

      reopen: (id) =>
        set((s) => ({
          prayers: s.prayers.map((p) =>
            p.id === id
              ? { ...p, status: 'active' as const, answeredAt: undefined, answeredNote: undefined }
              : p
          ),
        })),

      removePrayer: (id) => set((s) => ({ prayers: s.prayers.filter((p) => p.id !== id) })),

      addCanvas: (name) => {
        const canvas = makeCanvas(name, get().canvases)
        set((s) => ({
          canvases: [...s.canvases, canvas],
          visibleCanvasIds: [...s.visibleCanvasIds, canvas.id],
        }))
        return canvas.id
      },

      renameCanvas: (id, name) =>
        set((s) => ({
          canvases: s.canvases.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
        })),

      removeCanvas: (id, deletePrayers = false) =>
        set((s) => {
          if (s.canvases.length <= 1) return s
          const remaining = s.canvases.filter((c) => c.id !== id)
          const fallback = remaining[0].id
          const visible = s.visibleCanvasIds.filter((v) => v !== id)
          return {
            canvases: remaining,
            // Orphaned prayers either go with the canvas or move to the
            // first remaining one.
            prayers: deletePrayers
              ? s.prayers.filter((p) => p.canvasId !== id)
              : s.prayers.map((p) =>
                  p.canvasId === id ? { ...p, canvasId: fallback } : p
                ),
            visibleCanvasIds: visible.length > 0 ? visible : [fallback],
          }
        }),

      toggleCanvasVisible: (id) =>
        set((s) => {
          const visible = s.visibleCanvasIds.includes(id)
            ? s.visibleCanvasIds.filter((v) => v !== id)
            : [...s.visibleCanvasIds, id]
          // Never hide everything.
          return visible.length > 0 ? { visibleCanvasIds: visible } : s
        }),

      showOnlyCanvas: (id) =>
        set((s) => (s.canvases.some((c) => c.id === id) ? { visibleCanvasIds: [id] } : s)),

      showAllCanvases: () =>
        set((s) => ({ visibleCanvasIds: s.canvases.map((c) => c.id) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: (prayers, canvases, settings) =>
        set((s) => {
          const nextCanvases = canvases && canvases.length > 0 ? canvases : s.canvases
          return {
            prayers,
            canvases: nextCanvases,
            visibleCanvasIds: nextCanvases.map((c) => c.id),
            settings: { ...s.settings, ...settings },
          }
        }),
    }),
    {
      name: 'vesper:v1',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localAdapter),
      /**
       * Upgrades persisted data from older schema versions, one step at a
       * time. Keep every historical step so any old backup can climb to
       * the current shape.
       */
      migrate: (persisted, version) => {
        const state = persisted as {
          prayers?: Prayer[]
          canvases?: PrayerCanvas[]
          visibleCanvasIds?: string[]
          settings?: Partial<Settings>
        }
        if (version < 2) {
          // v2 added per-prayer journals.
          state.prayers = (state.prayers ?? []).map((p) => ({ ...p, journal: p.journal ?? [] }))
        }
        if (version < 3) {
          // v3 added canvases; existing prayers move onto one default canvas.
          const def = makeCanvas('Default', [])
          state.canvases = [def]
          state.visibleCanvasIds = [def.id]
          state.prayers = (state.prayers ?? []).map((p) => ({ ...p, canvasId: def.id }))
        }
        if (version < 4) {
          // v4 added prayer kinds (request | person).
          state.prayers = (state.prayers ?? []).map((p) => ({ ...p, kind: p.kind ?? 'request' }))
        }
        if (version < 5) {
          // v5 renamed journal note "answered" to "highlighted".
          state.prayers = (state.prayers ?? []).map((p) => ({
            ...p,
            journal: (p.journal ?? []).map((e) => {
              const legacy = e as JournalEntry & { answeredAt?: number }
              const { answeredAt, ...rest } = legacy
              return { ...rest, highlightedAt: legacy.highlightedAt ?? answeredAt }
            }),
          }))
        }
        return state
      },
      // Deep-merge settings so newly added keys keep their defaults for existing data.
      merge: (persisted, current) => {
        const p = persisted as Partial<VesperState> | undefined
        return {
          ...current,
          ...p,
          settings: {
            ...current.settings,
            ...p?.settings,
            orb: { ...current.settings.orb, ...p?.settings?.orb },
          },
        }
      },
    }
  )
)

/** True once the (async) persisted state has been loaded into the store. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(useVesper.persist.hasHydrated())
  useEffect(() => {
    const unsubscribe = useVesper.persist.onFinishHydration(() => setHydrated(true))
    // Hydration may have completed between first render and this subscription.
    if (useVesper.persist.hasHydrated()) setHydrated(true)
    return unsubscribe
  }, [])
  return hydrated
}
