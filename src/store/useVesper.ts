import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Prayer, Settings } from '../types'
import { localAdapter } from '../storage/adapter'

// Curated orb tones (see the engine's palette); gold is reserved for answered prayers.
const HUES = [216, 8, 100, 340, 275, 185]
const MAX_PRAYED_ENTRIES = 1000

/** Bump when the persisted shape changes, and handle it in `migrate` below. */
const SCHEMA_VERSION = 2

interface VesperState {
  prayers: Prayer[]
  settings: Settings
  addPrayer: (title: string, description?: string) => string
  pray: (id: string) => void
  updatePrayer: (id: string, patch: Partial<Pick<Prayer, 'title' | 'description'>>) => void
  addJournal: (id: string, text: string) => void
  markAnswered: (id: string, note?: string) => void
  reopen: (id: string) => void
  removePrayer: (id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (prayers: Prayer[], settings?: Partial<Settings>) => void
}

function nextHue(prayers: Prayer[]): number {
  const counts = HUES.map((hue) => prayers.filter((p) => p.hue === hue).length)
  return HUES[counts.indexOf(Math.min(...counts))]
}

export const useVesper = create<VesperState>()(
  persist(
    (set, get) => ({
      prayers: [],
      settings: {
        theme: 'light',
        halfLifeDays: 7,
        drift: 'calm',
        orb: { size: 'medium', rings: 3, glow: 'soft', core: 'soft' },
        showTitles: true,
        showAnswered: true,
        reduceMotion: false,
        showFps: false,
      },

      addPrayer: (title, description) => {
        const prayer: Prayer = {
          id: crypto.randomUUID(),
          title: title.trim(),
          description: description?.trim() || undefined,
          hue: nextHue(get().prayers),
          createdAt: Date.now(),
          prayedAt: [],
          journal: [],
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

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: (prayers, settings) =>
        set((s) => ({ prayers, settings: { ...s.settings, ...settings } })),
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
        const state = persisted as { prayers?: Prayer[]; settings?: Partial<Settings> }
        if (version < 2) {
          // v2 added per-prayer journals.
          state.prayers = (state.prayers ?? []).map((p) => ({ ...p, journal: p.journal ?? [] }))
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
  useEffect(() => useVesper.persist.onFinishHydration(() => setHydrated(true)), [])
  return hydrated
}
