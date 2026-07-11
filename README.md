# Vesper

A minimalist prayer app that replaces lists with a living canvas of floating orbs.

Each orb is a prayer request. The more consistently you pray for it, the brighter it glows; neglected prayers gently fade — not as a punishment, but as a quiet invitation to return. Tap an orb to pray, update it, or mark it as answered. Answered prayers remain on the canvas in gold, as lasting reminders of God's faithfulness.

## Stack

- **Vite + React + TypeScript + Sass** — the canvas itself is a hand-rolled 2D-canvas engine ([src/canvas/engine.ts](src/canvas/engine.ts))
- **Zustand (persisted)** for state, stored locally on-device
- **Capacitor** config included for wrapping as an Android/iOS app later

## Develop

```sh
npm install
npm run dev
```

## Deploy to Vercel

The app is a static Vite build — Vercel auto-detects it.

```sh
git init && git add -A && git commit -m "Vesper"
# push to GitHub, then import the repo at vercel.com — no config needed
# or deploy directly:
npx vercel
```

## Wrap as a native app (later)

Capacitor is already configured ([capacitor.config.ts](capacitor.config.ts), `webDir: dist`):

```sh
npm run build
npm run cap:add:android   # or cap:add:ios (requires Xcode on macOS)
npm run cap:sync          # after every web build
npx cap open android      # opens Android Studio / Xcode to run & ship
```

## Data & future sync

All data lives in IndexedDB (database `vesper`, key `vesper:v1`), with a versioned schema and step-wise migrations in the store (`SCHEMA_VERSION` in [src/store/useVesper.ts](src/store/useVesper.ts)); legacy localStorage data migrates across automatically, and localStorage remains the fallback where IndexedDB is unavailable. Persistence flows through a single adapter boundary ([src/storage/adapter.ts](src/storage/adapter.ts)) — to add cloud sync (Firebase, MongoDB, …), implement another `StateStorage` and swap it into the store. Settings include JSON export/import for manual backup meanwhile.

## License

MIT, see [LICENSE](LICENSE). If you build something on Vesper, a visible credit ("based on Vesper by John Chen") in your about screen or readme would be warmly appreciated.

## How an orb's light works

Vitality (0–1) is computed in [src/lib/vitality.ts](src/lib/vitality.ts):

- **Recency** (75%): half-life decay since the last time the prayer was prayed — the half-life is the "Fading" setting (7/14/30 days)
- **Consistency** (25%): how often it was prayed in the last 30 days
- Floored at 0.12 so a neglected orb dims to an ember but never disappears
