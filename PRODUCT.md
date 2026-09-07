# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Delivered as an Electron desktop application (macOS primary, with Windows and
Linux targets configured). The renderer is React + Tailwind; there is no mobile
or native-OS design language requirement.

## Users

Alex (the author) plus a small circle of friends and family who receive builds
directly. Not a public product with strangers arriving cold, but not a
single-user tool either: a newcomer must be able to install a build, get past
first run, and understand the interface without being talked through it.

They are on a desktop or laptop, usually settling in to watch something, often
resuming a series across multiple sittings.

## Product Purpose

Watch and track anime, movies and TV in one desktop app, and never lose your
place. Success is: opening the app, immediately seeing what you were part-way
through, and getting back into it in one click — plus a library that
accurately reflects what you have watched, are watching, and mean to watch.

## Positioning

StreamWatch is **equally a player and a tracker**. Streaming services (Disney+,
Netflix) play well but track shallowly — a single flat watchlist. Trackers
(AniList, Letterboxd, MyAnimeList) record meticulously but cannot play
anything. StreamWatch does both against a local library the user owns, spanning
two catalogues (anime and film/TV) that no single service covers together.

Neither half may be demoted to a supporting role in future work.

## Operating Context

- **Anime** — metadata from AniList; playback via extracted provider sources
  through an app-owned `<video>` element with HLS.
- **Movies & TV** — metadata from TMDB (user supplies their own API key at
  runtime; production builds ship without one); playback via third-party embed
  hosts rendered in a `<webview>`.
- Library lives in a local SQLite database (sql.js) under the app's userData
  directory, with atomic writes, a rolling backup, and corruption recovery.
- Distributed as signed-adhoc builds via GitHub releases with electron-updater.
- Sessions are long and lean-back; the window is often the only thing on screen.

## Capabilities and Constraints

- Five watch statuses: Watching, Plan to Watch, Completed, On Hold, Dropped.
- Per-episode progress and completion; resume position per episode; a
  Continue Watching surface derived from the most recent unfinished position.
- Discovery: trending/popular/genre rows, search, and filtering by genre, year,
  rating, sort and cast.
- User-configurable custom streaming sources; library import/export.
- **Third-party embed hosts are unreliable by nature** — they rotate, die, and
  vary by title and region. Dead sources are detected and auto-skipped. The UI
  must treat a failed source as an expected state, not an error.
- **Episodes never auto-advance in Movies & TV.** The "ended" signal comes from
  polling a third-party page and is not trustworthy; automatic advancement was
  deliberately removed. Episode changes are user-initiated.
- Anime and Movies/TV are currently separate modes with separate routes, pages,
  database tables, and settings, joined by a hub screen and a mode switcher.
  **The user has approved reworking this into a single unified shell**; the two
  data sources remain distinct behind it.

## Brand Commitments

- Name: **StreamWatch**. App id `com.streamwatch.app`.
- The userData directory is pinned to `anime-watch` and must not change, or
  existing users lose their library.
- Accent colour is already a themeable CSS custom property (`--color-accent`)
  with a user setting; theming is an existing capability, not a new idea.
- No committed typeface, logo, or illustration style exists.
- **Standing visual preference (chosen 2026-09-07):** the category standard,
  played straight. StreamWatch is to sit alongside **Disney+, Apple TV+ and
  Max**, and their craft level is the bar. Convention is the commitment here:
  no ironic or novel reinterpretation of streaming-app conventions.
- Single brand accent `#0063E5` on a cool near-black ground `#0B0D13`,
  replacing the previous per-mode accents (anime violet, movies red).

## Evidence on Hand

- Real content and imagery come from TMDB and AniList at runtime (posters,
  backdrops, episode stills, cast portraits). The interface always has real
  artwork to work with — no placeholder imagery is needed or appropriate.
- **No custom app icon exists**; builds ship the default Electron icon.
- No logo, marketing copy, testimonials, user counts, or press. None may be
  invented.

## Product Principles

1. **Never lose the user's place.** Resume state is the most valuable thing the
   app holds; it must be visible, accurate, and one click away.
2. **Player and tracker carry equal weight.** Neither discovery nor library
   management may be reduced to a secondary concern.
3. **Unreliable sources are a design problem, not an error case.** Failure,
   fallback, and switching sources must feel handled rather than broken.
4. **Nothing moves or advances without consent.** Auto-advance was removed for
   this reason; auto-rotating content must be pausable.
5. **The library is the user's, and local.** It survives reinstalls, is
   exportable, and never depends on an account.

## Accessibility & Inclusion

No formal standard has been established for this project. Two decisions are
already in force and should be treated as a floor: auto-rotating content
pauses on hover and focus, and honours `prefers-reduced-motion`. Long viewing
sessions in dark rooms make the dark theme the default rather than an option.
