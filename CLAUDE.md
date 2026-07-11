# Vesper

A minimalist prayer app: prayers are floating orbs on a living canvas. Praying for an orb keeps it bright; neglect makes it fade (never vanish). Built as a calmer, more beautiful alternative to PrayerMate where you pray over what *you* choose, not the next card.

## Stack & commands

- Vite + React 19 + TypeScript + Sass (all styling in `src/styles/_*.scss` partials via `@use`)
- Zustand (persisted) for state; hand-rolled 2D canvas engine (no animation libs)
- `npm run dev` / `npm run build` (tsc -b && vite build) / `npm run lint` (oxlint)
- Deploy: static Vite build on Vercel (auto-detected, no config)
- Native later: Capacitor configured (`capacitor.config.ts`, appId `com.vesper.app`, webDir `dist`); scripts `cap:sync`, `cap:add:android`, `cap:add:ios`

## Architecture

- `src/canvas/engine.ts` — the heart. OrbEngine class: physics (wander, inverted gravity, collisions, personal space, edge wrap), drawing (concentric-ring orbs, halo, heartbeat, ripples, comet trails, speck flakes, ascension sparks), interaction state (drag, hover/press lift, long-press charge, session focus), labels (2-line wrap + ellipsis, cached), fps EMA. Demo orb id `__demo` when canvas empty.
- `src/canvas/OrbCanvas.tsx` — React wrapper: syncs store→engine (per minute + on change), pointer gestures (tap <500ms opens popup; >6px movement = drag; 550ms still hold = long-press charge that fires prayer at full charge), ResizeObserver, theme/settings→engine fields.
- `src/store/useVesper.ts` — zustand + persist. `SCHEMA_VERSION = 4` with step-wise `migrate` (v2 added `journal`; v3 added canvases: `PrayerCanvas` entities, `prayer.canvasId`, `visibleCanvasIds` with a ≥1-visible invariant; v4 added `prayer.kind`: 'request' | 'person'). Deep-merges settings (incl. nested `orb`) so new keys keep defaults. `useHydrated()` hook (storage is async).
- `src/storage/adapter.ts` — IndexedDB-backed `StateStorage` (db `vesper`, store `kv`, key `vesper:v1`); auto-migrates legacy localStorage data in; localStorage is the fallback. Swap this adapter for future cloud sync (Firebase/Mongo).
- `src/lib/` — `vitality.ts` (0.75·recency half-life decay + 0.25·consistency, floor 0.12), `format.ts` (timeAgo, longDate, isSameDay), `backup.ts` (JSON export/import with validation), `theme.ts` (resolveTheme).
- `src/components/` — Sheet (animated open AND close, 200ms; render-prop `children(close)` so inner actions animate too; `anchor` prop floats it beside an orb with no dim/no blur), PrayerSheet (view/edit/answer modes, journal timeline, "Prayed today" line), AddPrayerSheet, SettingsSheet, AboutSheet, Fab (order: Pray, Settings, Answered, New prayer), SessionPanel, VespersBanner, FpsMeter, EmptyState, icons.
- `src/App.tsx` — panel/session/view/toast state, vespers banner logic (hour ≥17, waiting > 0, dismissible per-day via localStorage `vesper:vespers-dismissed`), theme→`data-theme` on root + theme-color meta.

## Key mechanics (product decisions, keep these)

- **Vitality** drives orb brightness/saturation; fades toward paper (light) / into night (dark). Fading is invitation, not punishment.
- **Prayed today** = outermost ring complete (dashed when waiting; praying "completes the circle"). Chosen over a dot on the ring (rejected as ugly).
- **Waiting orbs** (not prayed today) get extra centering gravity so tomorrow's prayers greet you mid-view; prayed ones roam free.
- **Session mode** queues ONLY today's unprayed prayers, oldest-prayed first; focused orb centres and breathes slow, others recede to 30%.
- **Long-press to pray**: 550ms hold starts a ~0.9s charge (ring draws inward), fires Amen without opening the popup, shows a top-centre toast "Amen · prayed for {title}" (3.4s slow fade).
- **Answered ascension**: orb stills and swells gold IN PLACE with radial spark burst. No upward drift (rejected as tacky).
- **Answered constellation**: FAB → Answered = gold-only canvas view with top bar.
- **Prayer kinds** (v4): a prayer is 'A request' or 'A person' (chips in add/edit sheets). People cannot be marked answered (no Answered button) and their delete action reads "Release". Individual journal NOTES are answerable instead (star toggle → gold entry with answered date): the person endures, the specifics inside them resolve into a private testimony timeline.
- Trails are comet-shaped filled polygons (wide at orb → point at tail), not stroked lines.
- Specks: irregular dark earthy tri/quad flakes with parallax depth (0.45–1.25 scales size/alpha/speed/push); react to orb wakes and Amen wavefronts; never draggable.
- Hue palette is curated (engine PALETTE keyed by hue: 216 slate, 8 terracotta, 100 sage, 340 rose, 275 plum, 185 teal); gold ≈42–46 reserved for answered.
- **Canvases** (v3): named collections of prayers; any subset visible (top-left pill + FAB → Canvases to manage/select). Each visible canvas is a constellation group: anchors on an ellipse around centre (centre itself when one canvas), per-group spread grows with √memberCount, and gravity pulls each orb to ITS anchor with real mid-range strength (30·(d/spread)^1.8, capped 160; waiting bonus 12·(d/spread)) — this replaced global-centre gravity and fixed a chronic left-drift (seeds are id-hashed; old fringe-only gravity never recentred them). Sessions/vespers scope to visible canvases. Density defenses: orb radius scales by √(30/n) (floor 0.6) past 30 orbs; labels past 40 orbs only for waiting/hovered/focused. Group colouring intentionally NOT done — spatial grouping first, see if it suffices. Future if scale demands: sprite caching, spatial hash, meta-orb-per-canvas overview.

## Design taste (user feedback, hard-won — respect it)

- NO em dashes in any user-facing copy.
- Inter for everything (no serif; Cormorant was removed).
- Light theme: warm off-white paper, sage green accent `#7f9065` (same green in dark mode; the yellowish sage was rejected).
- Dark theme: deep blue-purple page background, but panel surfaces are LIGHTER neutral grey `rgba(58,56,66)`; orb colours run notably brighter/more saturated in dark; labels near-white.
- No backdrop blur on sheet/panel backdrops. Prayer popup floats beside its orb (no dim) so ripples stay visible.
- Modals must animate closed, not just open.
- Subtle > flashy: things that "go up," oversized orbs, saturated flat blobs, and static-feeling orbs were all rejected. Continuous life = heartbeat swell + slow emanating ripple.
- No zoom/pan (was built, then removed as redundant once gravity kept orbs in view).
- Settings are constrained choices (segmented options), not free sliders; every combination must stay aesthetic. Fading shows half-life days on the options (3/7/14).

## Data & privacy stance

Everything on-device, no account/server/analytics (stated in About). Export/import JSON backups in Settings. About sheet frames the app around consistent prayer, citing 1 Thessalonians 5:17 as "always returning" rather than never stopping.

## Wishlist (also listed in AboutSheet)

Sharing a prayer with a friend, group prayer canvas, subscribing to a canvas (carry what others carry), scripture pinned to prayers, meta-orb overview (one orb per canvas), soft background music, cloud sync, native evening reminders. (Groupings/constellations shipped as Canvases in v3.) Also previously discussed: time-of-day background sky, optional sound on Amen, breathing guide in session, haptics via Capacitor, PWA service worker, migration tests still not written.

## Caveats

- LIVE: already deployed on Vercel and shipped — treat changes as changes to a production app.
- Typecheck/build were not run in the original build session (user drives their own dev server); verify with `npm run build` before deploying.
- Toast, vespers banner, and answered-view bar all occupy top-centre and can overlap.
