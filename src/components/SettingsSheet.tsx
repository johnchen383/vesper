import { useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { useVesper } from '../store/useVesper'
import { exportBackup, importBackup } from '../lib/backup'
import type { OrbDesign } from '../types'

const PACES = [
  { label: 'Swift', days: 3 },
  { label: 'Gentle', days: 7 },
  { label: 'Patient', days: 14 },
]

const DRIFTS = [
  { label: 'Calm', value: 'calm' as const },
  { label: 'Lively', value: 'lively' as const },
]

const THEMES = [
  { label: 'Light', value: 'light' as const },
  { label: 'Dark', value: 'dark' as const },
  { label: 'System', value: 'system' as const },
]

const ORB_OPTIONS: {
  key: keyof OrbDesign
  label: string
  choices: { label: string; value: OrbDesign[keyof OrbDesign] }[]
}[] = [
  {
    key: 'size',
    label: 'Size',
    choices: [
      { label: 'Small', value: 'small' },
      { label: 'Medium', value: 'medium' },
      { label: 'Large', value: 'large' },
    ],
  },
  {
    key: 'rings',
    label: 'Rings',
    choices: [
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: '4', value: 4 },
    ],
  },
  {
    key: 'glow',
    label: 'Glow',
    choices: [
      { label: 'Faint', value: 'faint' },
      { label: 'Soft', value: 'soft' },
      { label: 'Radiant', value: 'radiant' },
    ],
  },
  {
    key: 'core',
    label: 'Core',
    choices: [
      { label: 'Soft', value: 'soft' },
      { label: 'Bold', value: 'bold' },
    ],
  },
]

interface Props {
  onClose: () => void
  onAbout: () => void
}

export function SettingsSheet({ onClose, onAbout }: Props) {
  const settings = useVesper((s) => s.settings)
  const setSettings = useVesper((s) => s.setSettings)
  const prayerCount = useVesper((s) => s.prayers.length)
  const replaceAll = useVesper((s) => s.replaceAll)

  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <Sheet title="Settings" onClose={onClose}>
      <section className="settings__section">
        <h3>Appearance</h3>
        <div className="segmented">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              className={settings.theme === theme.value ? 'is-active' : ''}
              onClick={() => setSettings({ theme: theme.value })}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>Fading</h3>
        <p className="hint">How long an orb keeps half its light without prayer.</p>
        <div className="segmented">
          {PACES.map((pace) => (
            <button
              key={pace.days}
              className={settings.halfLifeDays === pace.days ? 'is-active' : ''}
              onClick={() => setSettings({ halfLifeDays: pace.days })}
            >
              {pace.label}
              <small>{pace.days} days</small>
            </button>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>Drift</h3>
        <p className="hint">How quickly the orbs wander the canvas.</p>
        <div className="segmented">
          {DRIFTS.map((drift) => (
            <button
              key={drift.value}
              className={settings.drift === drift.value ? 'is-active' : ''}
              onClick={() => setSettings({ drift: drift.value })}
            >
              {drift.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>Orbs</h3>
        {ORB_OPTIONS.map((option) => (
          <div className="control" key={option.key}>
            <span className="control__label">{option.label}</span>
            <div className="segmented">
              {option.choices.map((choice) => (
                <button
                  key={String(choice.value)}
                  className={settings.orb[option.key] === choice.value ? 'is-active' : ''}
                  onClick={() =>
                    setSettings({
                      orb: { ...settings.orb, [option.key]: choice.value } as OrbDesign,
                    })
                  }
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="settings__section">
        <h3>Canvas</h3>
        <label className="toggle-row">
          <span>Cluster by canvas</span>
          <input
            type="checkbox"
            checked={settings.clusterByCanvas}
            onChange={(e) => setSettings({ clusterByCanvas: e.target.checked })}
          />
          <i className="toggle" />
        </label>
        <label className="toggle-row">
          <span>Show prayer titles</span>
          <input
            type="checkbox"
            checked={settings.showTitles}
            onChange={(e) => setSettings({ showTitles: e.target.checked })}
          />
          <i className="toggle" />
        </label>
        <label className="toggle-row">
          <span>Show answered prayers</span>
          <input
            type="checkbox"
            checked={settings.showAnswered}
            onChange={(e) => setSettings({ showAnswered: e.target.checked })}
          />
          <i className="toggle" />
        </label>
        <label className="toggle-row">
          <span>Reduce motion</span>
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(e) => setSettings({ reduceMotion: e.target.checked })}
          />
          <i className="toggle" />
        </label>
        <label className="toggle-row">
          <span>Show frame rate</span>
          <input
            type="checkbox"
            checked={settings.showFps}
            onChange={(e) => setSettings({ showFps: e.target.checked })}
          />
          <i className="toggle" />
        </label>
      </section>

      <section className="settings__section">
        <h3>Your data</h3>
        <p className="hint">Prayers are stored on this device only.</p>
        <div className="row">
          <button className="btn" onClick={exportBackup} disabled={prayerCount === 0}>
            Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) setMessage((await importBackup(file)).message)
              e.target.value = ''
            }}
          />
          <button
            className="btn btn--danger"
            disabled={prayerCount === 0}
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true)
                return
              }
              replaceAll([])
              setConfirmClear(false)
            }}
          >
            {confirmClear
              ? `Really erase ${prayerCount} prayer${prayerCount === 1 ? '' : 's'}?`
              : 'Erase all'}
          </button>
        </div>
        {message && <p className="hint settings__message">{message}</p>}
      </section>

      <section className="settings__section">
        <button className="settings__about" onClick={onAbout}>
          About Vesper
        </button>
      </section>
    </Sheet>
  )
}
