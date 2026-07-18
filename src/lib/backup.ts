import type { JournalEntry, Prayer, PrayerCanvas, Settings } from '../types'
import { useVesper } from '../store/useVesper'

interface Backup {
  app: 'vesper'
  version: number
  exportedAt: number
  prayers: Prayer[]
  canvases?: PrayerCanvas[]
  settings: Settings
}

export function exportBackup() {
  const { prayers, canvases, settings } = useVesper.getState()
  const backup: Backup = {
    app: 'vesper',
    version: 2,
    exportedAt: Date.now(),
    prayers,
    canvases,
    settings,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vesper-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<{ ok: boolean; message: string }> {
  try {
    const data = JSON.parse(await file.text()) as Partial<Backup>
    if (data.app !== 'vesper' || !Array.isArray(data.prayers)) {
      return { ok: false, message: 'That file doesn’t look like a Vesper backup.' }
    }
    const canvases = (Array.isArray(data.canvases) ? data.canvases : []).filter(
      (c): c is PrayerCanvas => typeof c?.id === 'string' && typeof c?.name === 'string'
    )
    // Backups from before canvases existed get one default canvas.
    const resolved =
      canvases.length > 0
        ? canvases
        : [{ id: crypto.randomUUID(), name: 'Default', hue: 216, createdAt: Date.now() }]
    const knownIds = new Set(resolved.map((c) => c.id))
    const prayers = (data.prayers as unknown[])
      .filter((p): p is Prayer => {
        const c = p as Prayer
        return (
          !!c &&
          typeof c.id === 'string' &&
          typeof c.title === 'string' &&
          typeof c.createdAt === 'number' &&
          Array.isArray(c.prayedAt)
        )
      })
      .map((p) => ({
        ...p,
        hue: typeof p.hue === 'number' ? p.hue : 216,
        journal: (Array.isArray(p.journal) ? p.journal : []).map((e) => {
          // Backups from before v5 called highlights "answered".
          const legacy = e as JournalEntry & { answeredAt?: number }
          const { answeredAt, ...rest } = legacy
          return { ...rest, highlightedAt: legacy.highlightedAt ?? answeredAt }
        }),
        canvasId: knownIds.has(p.canvasId) ? p.canvasId : resolved[0].id,
        kind: p.kind === 'person' ? ('person' as const) : ('request' as const),
        status: p.status === 'answered' ? ('answered' as const) : ('active' as const),
      }))
    useVesper.getState().replaceAll(prayers, resolved, data.settings)
    return { ok: true, message: `Restored ${prayers.length} prayer${prayers.length === 1 ? '' : 's'}.` }
  } catch {
    return { ok: false, message: 'Could not read that file.' }
  }
}
