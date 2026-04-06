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

## License

MIT
