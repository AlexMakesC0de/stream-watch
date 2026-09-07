# StreamWatch

A clean, ad-free desktop app for streaming anime, movies, and TV shows — with built-in tracking so you never lose your place.

## Features

- **Anime** — Browse trending, seasonal, and popular anime (powered by AniList). Search by title, toggle SUB/DUB, auto-advance episodes.
- **Movies & TV** — Discover trending and popular movies & TV shows (powered by TMDB). Multiple streaming providers with one-click switching.
- **Library** — Organize everything into Watching, Plan to Watch, Completed, On Hold, Dropped.
- **Continue Watching** — Automatically saves your progress (episode + timestamp) so you can pick up right where you left off.
- **Ad-Free** — Built-in ad blocker strips popups, overlays, and redirects from embed players.
- **Cross-Platform** — Windows, macOS, and Linux.

## Install

Download the latest release for your platform from [Releases](https://github.com/AlexMakesC0de/anime-watch/releases).

| Platform | Format |
|----------|--------|
| Windows  | `.exe` installer |
| Linux    | `.AppImage` or `.deb` |
| macOS    | `.dmg` |

## Build from Source

```bash
npm install
npm run build
npm run package
```

Platform-specific:
```bash
npm run package:win    # Windows
npm run package:linux  # Linux
```

## Tech Stack

Electron · React · TypeScript · Tailwind CSS · sql.js

## Development notes

`npm run build` compiles but does **not** typecheck. To typecheck:

```bash
npx tsc --noEmit -p tsconfig.web.json    # renderer
npx tsc --noEmit -p tsconfig.node.json   # main + preload
```

Three type errors predate current work and are the expected baseline — a change
is clean if the counts are still **1 (web)** and **2 (node)**:
`MediaDetailPage.tsx` (union mismatch passing `similar` to `MediaGrid`),
`proxy.ts` (`session` missing from Electron's `RequestInit` type), and
`torrent.ts` (`webtorrent` has no type declarations).

Easy things to get wrong:

- **`build/` must exist and stay committed.** `electron-builder.yml` points
  `entitlementsInherit` at `build/entitlements.mac.plist`; packaging fails
  outright without it.
- **macOS signing is off on purpose** (`identity: null`). The only certificate
  available is an *Apple Development* one, which cannot notarize; the app has
  always shipped ad-hoc signed. Set a *Developer ID Application* identity there
  if one is ever obtained.
- **The router is a `HashRouter`** — routes are `#/movies`, not `/movies`.
- **`app.setName('anime-watch')`** is pinned in `src/main/index.ts` so the
  userData directory (which holds the library) stays put across versions.
  Changing it orphans every existing library.
- **The TMDB key is a runtime setting**, not bundled. Production builds show no
  films or TV until a key is entered in Settings; only `npm run dev` falls back
  to `.env`.

### Dead code, intentionally kept

The unified shell replaced the old two-mode structure — a landing "hub" that
chose between Anime and Movies & TV, plus a per-mode sidebar. These files are no
longer imported or routed anywhere. They are kept only so that structure can be
restored without rewriting it:

| File | Was |
|------|-----|
| `src/renderer/src/pages/HubPage.tsx` | Landing screen that chose a mode |
| `src/renderer/src/components/Sidebar.tsx` | Per-mode left nav, replaced by `TopNav` |
| `src/renderer/src/components/TitleBar.tsx` | Window chrome, now handled by `TopNav` |
| `src/renderer/src/pages/MoviesHomePage.tsx` | Old films/TV home, replaced by `HomeUnifiedPage` |

Nothing imports them, so removing them is a clean deletion whenever the hub is
definitively not coming back.

### Also outstanding

- `DESIGN.md` has never been written; the visual system lives only in
  `tailwind.config.js` and `src/renderer/src/styles/globals.css`.
- `AnimeWatchAPI` is declared **twice** — `src/preload/index.d.ts` and
  `src/renderer/src/env.d.ts` — and the two have already drifted. The renderer
  reads the `env.d.ts` copy, so adding a preload method means editing both.
- Both API caches (`services/tmdb.ts`, `services/anilist.ts`) are unbounded
  `Map`s with no eviction; they grow for the lifetime of a session.

## License

MIT
