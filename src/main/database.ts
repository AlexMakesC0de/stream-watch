import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

let db: SqlJsDatabase
let dbPath: string
let saveTimer: ReturnType<typeof setInterval> | null = null

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  dbPath = join(dbDir, 'anime-watch.db')

  const SQL = await initSqlJs()

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  createTables()
  migrateDubCache()
  persistToFile()

  // Auto-save every 30 seconds
  saveTimer = setInterval(persistToFile, 30_000)

  console.log(`[Database] Initialized at ${dbPath}`)
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

function persistToFile(): void {
  if (!db || !dbPath) return
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
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
