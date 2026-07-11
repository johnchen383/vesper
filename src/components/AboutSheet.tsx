import { Sheet } from './Sheet'

const WISHLIST = [
  'Sharing a prayer with a friend, so two people can carry it together',
  'Groupings: constellations of related prayers that drift as one',
  'Group prayer: a shared canvas for a family, small group, or church',
  'Scripture integration: pin a verse or promise to a prayer',
  'Cloud sync across devices',
  'Gentle evening reminders as a native app',
]

export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="About Vesper" onClose={onClose}>
      <section className="settings__section">
        <p className="about__blurb">
          <em>Vesper</em> is the evening star, the first light to appear as the day quiets. It is
          also the old name for evening prayer. This app is a small attempt at both: a quiet
          canvas where each prayer is a living light.
        </p>
        <p className="about__blurb">
          Vesper is built around consistency. An orb brightens as you return to it and slowly dims
          when you drift away, never as a punishment, only as a quiet invitation to come back.
          "Pray without ceasing" (1 Thessalonians 5:17) is less about never stopping and more
          about always returning, and that rhythm of returning is what this canvas hopes to
          encourage.
        </p>
      </section>

      <section className="settings__section">
        <h3>Your data</h3>
        <p className="hint">
          Everything you write stays on this device, stored in your browser's IndexedDB. Nothing
          is sent anywhere. There is no account, no server, and no analytics. Use{' '}
          <strong>Settings → Export backup</strong> to keep a copy or move to another device.
        </p>
      </section>

      <section className="settings__section">
        <h3>Wishlist</h3>
        <p className="hint">Where Vesper hopes to go, in time:</p>
        <ul className="about__wishlist">
          {WISHLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="settings__section">
        <p className="hint">Vesper · v0.1</p>
      </section>
    </Sheet>
  )
}
