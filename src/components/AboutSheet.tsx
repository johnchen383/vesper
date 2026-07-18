import { Sheet } from './Sheet'

const WISHLIST = [
  'Sharing a prayer with a friend, so two people can carry it together',
  'Group prayer: a shared canvas for a family, small group, or church',
  'Subscribing to a canvas, so you can carry what others are carrying',
  'Scripture integration: pin a verse or promise to a prayer',
  'Soft background music for a quieter place to dwell',
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
          when you drift away, never as a punishment, only as a quiet invitation to come back. The
          hope is that small, daily returns grow into a rhythm, and the rhythm into a life of
          prayer without ceasing (1 Thessalonians 5:17).
        </p>
      </section>

      <section className="settings__section">
        <h3>Your data</h3>
        <p className="hint">
          Everything you write stays on this device, stored in your browser's cache. Nothing
          is sent anywhere. There is no account, no server, and no analytics. Use{' '}
          <strong>Settings → Export</strong> to keep a copy or move to another device.
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
        <p className="hint">Vesper · v0.1 · {__COMMIT__}</p>
      </section>
    </Sheet>
  )
}
