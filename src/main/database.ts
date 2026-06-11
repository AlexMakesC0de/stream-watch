import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js'
import { app } from 'electron'
import { join, dirname } from 'path'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync
} from 'fs'

let db: SqlJsDatabase
let dbPath: string
let backupPath: string
let saveTimer: ReturnType<typeof setInterval> | null = null

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  dbPath = join(dbDir, 'anime-watch.db')
  backupPath = `${dbPath}.bak`

  const SQL = await initSqlJs()

  // Recover a library that may live under a previous app name (e.g. "StreamWatch").
  migrateLegacyData(userDataPath)

  db = loadDatabase(SQL)

  createTables()
  migrateDubCache()
  persistToFile() // write schema to disk atomically
  writeBackup() // snapshot the known-good state

  // Auto-save and refresh the backup every 30 seconds.
  saveTimer = setInterval(() => {
    persistToFile()
    writeBackup()
  }, 30_000)

  console.log(`[Database] Initialized at ${dbPath}`)
}

// If the current database is missing but an older one exists under a previous
// app name, copy it across so the user's library survives the rename.
function migrateLegacyData(userDataPath: string): void {
  if (existsSync(dbPath)) return
  const appSupport = dirname(userDataPath)
  const legacyPaths = [join(appSupport, 'StreamWatch', 'data', 'anime-watch.db')]

  for (const legacy of legacyPaths) {
    try {
      if (existsSync(legacy) && readFileSync(legacy).length > 0) {
        copyFileSync(legacy, dbPath)
        console.log(`[Database] Migrated library from legacy location: ${legacy}`)
        return
      }
    } catch (err) {
      console.warn('[Database] Legacy migration failed:', err)
    }
  }
}

// Open a database file only if it is present, non-empty, and a valid SQLite file.
// Returns null when the file is absent; throws when the file exists but is corrupt.
function openValidated(SQL: SqlJsStatic, file: string): SqlJsDatabase | null {
  if (!existsSync(file)) return null
  const buffer = readFileSync(file)
  if (buffer.length === 0) return null
  const candidate = new SQL.Database(buffer)
  candidate.exec('PRAGMA schema_version') // throws if the buffer is not a real SQLite db
  return candidate
}

// Load the database with fallbacks: primary file → backup → fresh. A corrupt
// primary is preserved (renamed aside) rather than discarded, so nothing is
// ever silently destroyed.
function loadDatabase(SQL: SqlJsStatic): SqlJsDatabase {
  try {
    const main = openValidated(SQL, dbPath)
    if (main) return main
  } catch (err) {
    console.error('[Database] Primary database is corrupt, trying backup:', err)
    try {
      renameSync(dbPath, `${dbPath}.corrupt-${Date.now()}`)
    } catch {
      /* ignore — we still try the backup below */
    }
  }

  try {
    const backup = openValidated(SQL, backupPath)
    if (backup) {
      console.warn('[Database] Recovered library from backup')
      return backup
    }
  } catch (err) {
    console.error('[Database] Backup database is also corrupt:', err)
  }

  console.warn('[Database] No valid database found — starting fresh')
  return new SQL.Database()
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anilist_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      title_english TEXT,
      cover_image TEXT,
      banner_image TEXT,
      description TEXT,
      episodes_total INTEGER,
      status TEXT NOT NULL DEFAULT 'PLAN_TO_WATCH',
      format TEXT,
      genres TEXT,
      season TEXT,
      season_year INTEGER,
      score REAL,
      added_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS watch_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      watched_seconds REAL DEFAULT 0,
      total_seconds REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      video_source TEXT,
      watched_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      UNIQUE(anime_id, episode_number)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS provider_cache (
      anilist_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      cached_at DATETIME DEFAULT (datetime('now')),
      PRIMARY KEY (anilist_id, provider)
    )
  `)

  try { db.run('CREATE INDEX idx_anime_status ON anime(status)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_anime_anilist_id ON anime(anilist_id)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_progress_anime ON watch_progress(anime_id)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_progress_watched ON watch_progress(watched_at)') } catch { /* exists */ }

  // ── Media tables (Movies & TV) ──────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_path TEXT,
      backdrop_path TEXT,
      overview TEXT,
      release_date TEXT,
      vote_average REAL,
      genres TEXT,
      runtime INTEGER,
      number_of_seasons INTEGER,
      number_of_episodes INTEGER,
      status TEXT NOT NULL DEFAULT 'PLAN_TO_WATCH',
      added_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(tmdb_id, media_type)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS media_watch_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id INTEGER NOT NULL,
      season_number INTEGER,
      episode_number INTEGER,
      watched_seconds REAL DEFAULT 0,
      total_seconds REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      watched_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
      UNIQUE(media_id, season_number, episode_number)
    )
  `)

  try { db.run('CREATE INDEX idx_media_status ON media(status)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_media_tmdb ON media(tmdb_id, media_type)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_media_progress_media ON media_watch_progress(media_id)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_media_progress_watched ON media_watch_progress(watched_at)') } catch { /* exists */ }

  // ── Settings ─────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
}

function migrateDubCache(): void {
  // One-time migration: Clear all gogoanime-dub cache entries to force re-matching
  // with the improved scoring algorithm (fixes sequels being matched instead of base series)
  try {
    const result = db.exec("SELECT COUNT(*) as count FROM provider_cache WHERE provider = 'gogoanime-dub'")
    const count = result[0]?.values[0]?.[0] as number || 0
    if (count > 0) {
      db.run("DELETE FROM provider_cache WHERE provider = 'gogoanime-dub'")
      console.log(`[Database] Cleared ${count} stale dub cache entries`)
    }
  } catch (err) {
    console.warn('[Database] Migration failed:', err)
  }
}

// Write atomically: serialise to a temp file, then rename over the target.
// rename() is atomic on the same filesystem, so an interrupted write can never
// leave a half-written (corrupt) database behind.
function atomicWrite(file: string, data: Buffer): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, file)
}

function persistToFile(): void {
  if (!db || !dbPath) return
  try {
    atomicWrite(dbPath, Buffer.from(db.export()))
  } catch (err) {
    console.error('[Database] Failed to save database:', err)
  }
}

function writeBackup(): void {
  if (!db || !backupPath) return
  try {
    atomicWrite(backupPath, Buffer.from(db.export()))
  } catch (err) {
    console.error('[Database] Failed to write backup:', err)
  }
}

// ─── Query helpers ────────────────────────────────────────────

function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return results
}

function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const results = queryAll(sql, params)
  return results[0] || null
}

function execute(sql: string, params: unknown[] = []): void {
  db.run(sql, params)
  persistToFile()
}

// ─── Public API ───────────────────────────────────────────────

export function addAnime(anime: Record<string, unknown>): void {
  execute(
    `INSERT OR REPLACE INTO anime
      (anilist_id, title, title_english, cover_image, banner_image, description,
       episodes_total, status, format, genres, season, season_year, score, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      anime.anilistId, anime.title, anime.titleEnglish, anime.coverImage, anime.bannerImage,
      anime.description, anime.episodesTotal, anime.status, anime.format, anime.genres,
      anime.season, anime.seasonYear, anime.score
    ]
  )
}

export function getLibrary(status?: string): Record<string, unknown>[] {
  if (status) {
    return queryAll('SELECT * FROM anime WHERE status = ? ORDER BY updated_at DESC', [status])
  }
  return queryAll('SELECT * FROM anime ORDER BY updated_at DESC')
}

export function getAnime(anilistId: number): Record<string, unknown> | null {
  return queryOne('SELECT * FROM anime WHERE anilist_id = ?', [anilistId])
}

export function updateStatus(anilistId: number, status: string): void {
  execute(
    "UPDATE anime SET status = ?, updated_at = datetime('now') WHERE anilist_id = ?",
    [status, anilistId]
  )
}

export function removeAnime(anilistId: number): void {
  execute(
    'DELETE FROM watch_progress WHERE anime_id = (SELECT id FROM anime WHERE anilist_id = ?)',
    [anilistId]
  )
  execute('DELETE FROM anime WHERE anilist_id = ?', [anilistId])
}

export function saveProgress(progress: Record<string, unknown>): void {
  const existing = queryOne(
    `SELECT wp.id FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ? AND wp.episode_number = ?`,
    [progress.anilistId, progress.episodeNumber]
  )

  if (existing) {
    // Never un-complete an episode that's already been marked as completed
    const current = queryOne('SELECT completed FROM watch_progress WHERE id = ?', [existing.id])
    const wasCompleted = current && (current.completed as number) === 1
    const newCompleted = wasCompleted ? 1 : progress.completed

    execute(
      `UPDATE watch_progress SET
        watched_seconds = ?, total_seconds = ?, completed = ?,
        video_source = COALESCE(?, video_source), watched_at = datetime('now')
       WHERE id = ?`,
      [progress.watchedSeconds, progress.totalSeconds, newCompleted, progress.videoSource, existing.id]
    )
  } else {
    execute(
      `INSERT INTO watch_progress (anime_id, episode_number, watched_seconds, total_seconds, completed, video_source)
       VALUES ((SELECT id FROM anime WHERE anilist_id = ?), ?, ?, ?, ?, ?)`,
      [
        progress.anilistId, progress.episodeNumber, progress.watchedSeconds,
        progress.totalSeconds, progress.completed, progress.videoSource
      ]
    )
  }
}

export function getProgress(anilistId: number): Record<string, unknown>[] {
  return queryAll(
    `SELECT wp.* FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ?
     ORDER BY wp.episode_number ASC`,
    [anilistId]
  )
}

export function getEpisodeProgress(
  anilistId: number,
  episodeNumber: number
): Record<string, unknown> | null {
  return queryOne(
    `SELECT wp.* FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ? AND wp.episode_number = ?`,
    [anilistId, episodeNumber]
  )
}

export function getContinueWatching(): Record<string, unknown>[] {
  return queryAll(
    `SELECT a.*, wp.episode_number as last_episode, wp.watched_seconds, wp.total_seconds
     FROM anime a
     JOIN watch_progress wp ON wp.anime_id = a.id
     WHERE a.status = 'WATCHING'
       AND wp.watched_at = (
         SELECT MAX(wp2.watched_at) FROM watch_progress wp2 WHERE wp2.anime_id = a.id
       )
       AND wp.completed = 0
     ORDER BY wp.watched_at DESC
     LIMIT 20`
  )
}

// ─── Provider Cache ───────────────────────────────────────────

export function getProviderMapping(anilistId: number, provider: string): string | null {
  const row = queryOne(
    'SELECT provider_id FROM provider_cache WHERE anilist_id = ? AND provider = ?',
    [anilistId, provider]
  )
  return row ? (row.provider_id as string) : null
}

export function setProviderMapping(anilistId: number, provider: string, providerId: string): void {
  execute(
    `INSERT OR REPLACE INTO provider_cache (anilist_id, provider, provider_id, cached_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [anilistId, provider, providerId]
  )
}

export function clearProviderMapping(anilistId: number): void {
  execute('DELETE FROM provider_cache WHERE anilist_id = ?', [anilistId])
}

export function toggleEpisodeCompleted(
  anilistId: number,
  episodeNumber: number,
  completed: boolean
): void {
  const existing = queryOne(
    `SELECT wp.id FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ? AND wp.episode_number = ?`,
    [anilistId, episodeNumber]
  )

  if (existing) {
    execute(
      `UPDATE watch_progress SET completed = ?, watched_at = datetime('now') WHERE id = ?`,
      [completed ? 1 : 0, existing.id]
    )
  } else if (completed) {
    // Create a new progress entry marked as completed
    execute(
      `INSERT INTO watch_progress (anime_id, episode_number, watched_seconds, total_seconds, completed)
       VALUES ((SELECT id FROM anime WHERE anilist_id = ?), ?, 0, 0, 1)`,
      [anilistId, episodeNumber]
    )
  }
}

export function markAllEpisodesCompleted(anilistId: number, totalEpisodes: number): void {
  const animeRow = queryOne('SELECT id FROM anime WHERE anilist_id = ?', [anilistId])
  if (!animeRow) return

  const animeId = animeRow.id as number

  for (let ep = 1; ep <= totalEpisodes; ep++) {
    const existing = queryOne(
      'SELECT id FROM watch_progress WHERE anime_id = ? AND episode_number = ?',
      [animeId, ep]
    )
    if (existing) {
      db.run(
        `UPDATE watch_progress SET completed = 1, watched_at = datetime('now') WHERE id = ?`,
        [existing.id]
      )
    } else {
      db.run(
        `INSERT INTO watch_progress (anime_id, episode_number, watched_seconds, total_seconds, completed)
         VALUES (?, ?, 0, 0, 1)`,
        [animeId, ep]
      )
    }
  }
  persistToFile()
}

export function closeDatabase(): void {
  if (saveTimer) clearInterval(saveTimer)
  if (db) {
    persistToFile()
    writeBackup()
    db.close()
  }
}

// ═══════════════════════════════════════════════════════════════
//  MEDIA (Movies & TV) — mirrors the anime API above
// ═══════════════════════════════════════════════════════════════

export function addMedia(media: Record<string, unknown>): void {
  execute(
    `INSERT OR REPLACE INTO media
      (tmdb_id, media_type, title, poster_path, backdrop_path, overview,
       release_date, vote_average, genres, runtime, number_of_seasons,
       number_of_episodes, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      media.tmdbId, media.mediaType, media.title, media.posterPath, media.backdropPath,
      media.overview, media.releaseDate, media.voteAverage, media.genres, media.runtime,
      media.numberOfSeasons, media.numberOfEpisodes, media.status
    ]
  )
}

export function getMediaLibrary(status?: string): Record<string, unknown>[] {
  if (status) {
    return queryAll('SELECT * FROM media WHERE status = ? ORDER BY updated_at DESC', [status])
  }
  return queryAll('SELECT * FROM media ORDER BY updated_at DESC')
}

export function getMedia(tmdbId: number, mediaType: string): Record<string, unknown> | null {
  return queryOne('SELECT * FROM media WHERE tmdb_id = ? AND media_type = ?', [tmdbId, mediaType])
}

export function updateMediaStatus(tmdbId: number, mediaType: string, status: string): void {
  execute(
    "UPDATE media SET status = ?, updated_at = datetime('now') WHERE tmdb_id = ? AND media_type = ?",
    [status, tmdbId, mediaType]
  )
}

export function removeMedia(tmdbId: number, mediaType: string): void {
  execute(
    'DELETE FROM media_watch_progress WHERE media_id = (SELECT id FROM media WHERE tmdb_id = ? AND media_type = ?)',
    [tmdbId, mediaType]
  )
  execute('DELETE FROM media WHERE tmdb_id = ? AND media_type = ?', [tmdbId, mediaType])
}

export function saveMediaProgress(progress: Record<string, unknown>): void {
  const existing = queryOne(
    `SELECT mwp.id, mwp.completed FROM media_watch_progress mwp
     JOIN media m ON mwp.media_id = m.id
     WHERE m.tmdb_id = ? AND m.media_type = ? AND mwp.season_number IS ? AND mwp.episode_number IS ?`,
    [progress.tmdbId, progress.mediaType, progress.seasonNumber ?? null, progress.episodeNumber ?? null]
  )

  if (existing) {
    const wasCompleted = (existing.completed as number) === 1
    const newCompleted = wasCompleted ? 1 : progress.completed

    execute(
      `UPDATE media_watch_progress SET
        watched_seconds = ?, total_seconds = ?, completed = ?, watched_at = datetime('now')
       WHERE id = ?`,
      [progress.watchedSeconds, progress.totalSeconds, newCompleted, existing.id]
    )
  } else {
    execute(
      `INSERT INTO media_watch_progress (media_id, season_number, episode_number, watched_seconds, total_seconds, completed)
       VALUES ((SELECT id FROM media WHERE tmdb_id = ? AND media_type = ?), ?, ?, ?, ?, ?)`,
      [
        progress.tmdbId, progress.mediaType, progress.seasonNumber ?? null,
        progress.episodeNumber ?? null, progress.watchedSeconds,
        progress.totalSeconds, progress.completed
      ]
    )
  }
}

export function getMediaProgress(
  tmdbId: number,
  mediaType: string
): Record<string, unknown>[] {
  return queryAll(
    `SELECT mwp.* FROM media_watch_progress mwp
     JOIN media m ON mwp.media_id = m.id
     WHERE m.tmdb_id = ? AND m.media_type = ?
     ORDER BY mwp.season_number ASC, mwp.episode_number ASC`,
    [tmdbId, mediaType]
  )
}

export function getMediaEpisodeProgress(
  tmdbId: number,
  mediaType: string,
  seasonNumber: number | null,
  episodeNumber: number | null
): Record<string, unknown> | null {
  return queryOne(
    `SELECT mwp.* FROM media_watch_progress mwp
     JOIN media m ON mwp.media_id = m.id
     WHERE m.tmdb_id = ? AND m.media_type = ? AND mwp.season_number IS ? AND mwp.episode_number IS ?`,
    [tmdbId, mediaType, seasonNumber, episodeNumber]
  )
}

export function getMediaContinueWatching(): Record<string, unknown>[] {
  return queryAll(
    `SELECT m.*, mwp.season_number as last_season, mwp.episode_number as last_episode,
            mwp.watched_seconds, mwp.total_seconds
     FROM media m
     JOIN media_watch_progress mwp ON mwp.media_id = m.id
     WHERE m.status = 'WATCHING'
       AND mwp.watched_at = (
         SELECT MAX(mwp2.watched_at) FROM media_watch_progress mwp2 WHERE mwp2.media_id = m.id
       )
       AND mwp.completed = 0
     ORDER BY mwp.watched_at DESC
     LIMIT 20`
  )
}

export function toggleMediaEpisodeCompleted(
  tmdbId: number,
  mediaType: string,
  seasonNumber: number | null,
  episodeNumber: number | null,
  completed: boolean
): void {
  const existing = queryOne(
    `SELECT mwp.id FROM media_watch_progress mwp
     JOIN media m ON mwp.media_id = m.id
     WHERE m.tmdb_id = ? AND m.media_type = ? AND mwp.season_number IS ? AND mwp.episode_number IS ?`,
    [tmdbId, mediaType, seasonNumber, episodeNumber]
  )

  if (existing) {
    execute(
      `UPDATE media_watch_progress SET completed = ?, watched_at = datetime('now') WHERE id = ?`,
      [completed ? 1 : 0, existing.id]
    )
  } else if (completed) {
    execute(
      `INSERT INTO media_watch_progress (media_id, season_number, episode_number, watched_seconds, total_seconds, completed)
       VALUES ((SELECT id FROM media WHERE tmdb_id = ? AND media_type = ?), ?, ?, 0, 0, 1)`,
      [tmdbId, mediaType, seasonNumber, episodeNumber]
    )
  }
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════

const SETTING_DEFAULTS: Record<string, string> = {
  'accentColor': '#6c5ce7',
  'movieAccentColor': '#e50914',
  'tmdbApiKey': '',
  'customEmbedProviders': '[]',
  'popcornMirrors': 'https://fusme.link,https://jfper.link,https://uxert.link,https://yrkde.link',
  'torrentTimeout': '90',
  'maxTorrentConnections': '100',
  'seedAfterDownload': 'false'
}

export function getSetting(key: string): string {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key])
  return row ? (row.value as string) : (SETTING_DEFAULTS[key] ?? '')
}

export function setSetting(key: string, value: string): void {
  execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  )
}

export function getAllSettings(): Record<string, string> {
  const rows = queryAll('SELECT key, value FROM settings')
  const settings = { ...SETTING_DEFAULTS }
  for (const row of rows) {
    settings[row.key as string] = row.value as string
  }
  return settings
}

export function resetSettings(): void {
  execute('DELETE FROM settings')
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT / IMPORT  (library backup & restore)
// ═══════════════════════════════════════════════════════════════

export interface LibraryExport {
  app: 'stream-watch'
  version: number
  exportedAt: string
  anime: Record<string, unknown>[]
  media: Record<string, unknown>[]
  settings: Record<string, string>
}

export interface ImportResult {
  anime: number
  media: number
  settings: number
}

// Serialise the full library to a portable structure keyed by natural ids
// (anilist_id / tmdb_id) so it can be re-imported into any database.
export function exportLibrary(): LibraryExport {
  const anime = queryAll('SELECT * FROM anime ORDER BY added_at ASC').map((a) => ({
    anilist_id: a.anilist_id,
    title: a.title,
    title_english: a.title_english,
    cover_image: a.cover_image,
    banner_image: a.banner_image,
    description: a.description,
    episodes_total: a.episodes_total,
    status: a.status,
    format: a.format,
    genres: a.genres,
    season: a.season,
    season_year: a.season_year,
    score: a.score,
    progress: queryAll(
      `SELECT episode_number, watched_seconds, total_seconds, completed, video_source
       FROM watch_progress WHERE anime_id = ? ORDER BY episode_number ASC`,
      [a.id]
    )
  }))

  const media = queryAll('SELECT * FROM media ORDER BY added_at ASC').map((m) => ({
    tmdb_id: m.tmdb_id,
    media_type: m.media_type,
    title: m.title,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    overview: m.overview,
    release_date: m.release_date,
    vote_average: m.vote_average,
    genres: m.genres,
    runtime: m.runtime,
    number_of_seasons: m.number_of_seasons,
    number_of_episodes: m.number_of_episodes,
    status: m.status,
    progress: queryAll(
      `SELECT season_number, episode_number, watched_seconds, total_seconds, completed
       FROM media_watch_progress WHERE media_id = ? ORDER BY season_number ASC, episode_number ASC`,
      [m.id]
    )
  }))

  const settings: Record<string, string> = {}
  for (const row of queryAll('SELECT key, value FROM settings')) {
    settings[row.key as string] = row.value as string
  }

  return {
    app: 'stream-watch',
    version: 1,
    exportedAt: new Date().toISOString(),
    anime,
    media,
    settings
  }
}

// Merge an exported library into the current database. Existing entries are
// updated (matched on natural id); nothing is deleted, so importing is additive
// and safe to run against a populated library.
export function importLibrary(
  data: LibraryExport,
  opts: { includeSettings?: boolean } = {}
): ImportResult {
  if (!data || typeof data !== 'object' || (data.app && data.app !== 'stream-watch')) {
    throw new Error('This file is not a valid StreamWatch library export.')
  }

  let animeCount = 0
  for (const a of data.anime ?? []) {
    addAnime({
      anilistId: a.anilist_id,
      title: a.title,
      titleEnglish: a.title_english,
      coverImage: a.cover_image,
      bannerImage: a.banner_image,
      description: a.description,
      episodesTotal: a.episodes_total,
      status: a.status,
      format: a.format,
      genres: a.genres,
      season: a.season,
      seasonYear: a.season_year,
      score: a.score
    })
    for (const p of (a.progress as Record<string, unknown>[]) ?? []) {
      saveProgress({
        anilistId: a.anilist_id,
        episodeNumber: p.episode_number,
        watchedSeconds: p.watched_seconds,
        totalSeconds: p.total_seconds,
        completed: p.completed,
        videoSource: p.video_source
      })
    }
    animeCount++
  }

  let mediaCount = 0
  for (const m of data.media ?? []) {
    addMedia({
      tmdbId: m.tmdb_id,
      mediaType: m.media_type,
      title: m.title,
      posterPath: m.poster_path,
      backdropPath: m.backdrop_path,
      overview: m.overview,
      releaseDate: m.release_date,
      voteAverage: m.vote_average,
      genres: m.genres,
      runtime: m.runtime,
      numberOfSeasons: m.number_of_seasons,
      numberOfEpisodes: m.number_of_episodes,
      status: m.status
    })
    for (const p of (m.progress as Record<string, unknown>[]) ?? []) {
      saveMediaProgress({
        tmdbId: m.tmdb_id,
        mediaType: m.media_type,
        seasonNumber: p.season_number ?? null,
        episodeNumber: p.episode_number ?? null,
        watchedSeconds: p.watched_seconds,
        totalSeconds: p.total_seconds,
        completed: p.completed
      })
    }
    mediaCount++
  }

  let settingsCount = 0
  if (opts.includeSettings && data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      setSetting(key, String(value))
      settingsCount++
    }
  }

  persistToFile()
  writeBackup()
  return { anime: animeCount, media: mediaCount, settings: settingsCount }
}
