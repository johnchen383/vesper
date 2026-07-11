import type { Prayer, Settings } from '../types'
import { useVesper } from '../store/useVesper'

interface Backup {
  app: 'vesper'
  version: 1
  exportedAt: number
  prayers: Prayer[]
  settings: Settings
}

export function exportBackup() {
  const { prayers, settings } = useVesper.getState()
  const backup: Backup = { app: 'vesper', version: 1, exportedAt: Date.now(), prayers, settings }
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
        journal: Array.isArray(p.journal) ? p.journal : [],
        status: p.status === 'answered' ? ('answered' as const) : ('active' as const),
      }))
    useVesper.getState().replaceAll(prayers, data.settings)
    return { ok: true, message: `Restored ${prayers.length} prayer${prayers.length === 1 ? '' : 's'}.` }
  } catch {
    return { ok: false, message: 'Could not read that file.' }
  }
}
