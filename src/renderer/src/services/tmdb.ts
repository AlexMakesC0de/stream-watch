import type {
  TMDBMovie,
  TMDBTvShow,
  TMDBPage,
  TMDBMediaItem,
  TMDBSeason,
  TMDBGenre,
  TMDBPerson,
  MediaType
} from '@/types'

const TMDB_BASE = 'https://api.themoviedb.org/3'
export const TMDB_IMG = 'https://image.tmdb.org/t/p'

// ─── API key (runtime, user-configurable) ────────────────────
// The key is read from user settings at runtime — never baked into the build.
// A build-time env var is only used as a development fallback.

let cachedApiKey: string | null = null
let apiKeyPromise: Promise<string> | null = null

async function getApiKey(): Promise<string> {
  if (cachedApiKey !== null) return cachedApiKey
  if (!apiKeyPromise) {
    apiKeyPromise = (async () => {
      let key = ''
      try {
        key = (await window.api.getSetting('tmdbApiKey'))?.trim() || ''
      } catch {
        /* settings bridge unavailable */
      }
      // Development-only convenience fallback. `import.meta.env.DEV` is
      // statically false in production, so this branch (and the inlined env
      // value) is stripped from release builds — the key is never bundled.
      if (!key && import.meta.env.DEV) {
        key = (import.meta.env.VITE_TMDB_API_KEY as string | undefined)?.trim() || ''
      }
      cachedApiKey = key
      return key
    })()
  }
  return apiKeyPromise
}

// Apply a new key immediately (called from Settings) — avoids needing a restart.
export function setTmdbApiKey(key: string): void {
  cachedApiKey = key.trim()
  apiKeyPromise = null
}

export async function isTmdbApiKeyConfigured(): Promise<boolean> {
  return (await getApiKey()).length > 0
}

export class TmdbApiKeyMissingError extends Error {
  constructor() {
    super('TMDB API key not configured')
    this.name = 'TmdbApiKeyMissingError'
  }
}

// ─── In-memory cache ─────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL = 5 * 60 * 1000

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

// ─── Fetch helper ────────────────────────────────────────────

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new TmdbApiKeyMissingError()

  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'en-US')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url.toString())

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10)
      const delay = Math.min(retryAfter * 1000, 5000)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
    }

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  throw new Error('TMDB API: max retries exceeded')
}

// ─── Genre id → name ─────────────────────────────────────────
// Stable TMDB genre ids (movie + TV combined).

const GENRE_NAMES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics'
}

export function genreNames(ids: number[] | undefined, limit = 3): string[] {
  if (!ids) return []
  return ids.map((id) => GENRE_NAMES[id]).filter(Boolean).slice(0, limit)
}

// ─── Discover by streaming provider ──────────────────────────
// `providerIds` is a TMDB-style pipe-joined list (e.g. "8" or "1899|384").

export async function discoverByWatchProvider(
  providerIds: string,
  region: string,
  page = 1
): Promise<TMDBPage<TMDBMovie>> {
  const key = `provider:${providerIds}:${region}:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/discover/movie', {
    with_watch_providers: providerIds,
    watch_region: region,
    with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc',
    'vote_count.gte': '40',
    page: String(page)
  })
  setCache(key, data)
  return data
}

// ─── Image URL helpers ───────────────────────────────────────

export function posterUrl(path: string | null, size = 'w342'): string {
  if (!path) return ''
  return `${TMDB_IMG}/${size}${path}`
}

export function backdropUrl(path: string | null, size = 'w1280'): string {
  if (!path) return ''
  return `${TMDB_IMG}/${size}${path}`
}

export function profileUrl(path: string | null, size = 'w185'): string {
  if (!path) return ''
  return `${TMDB_IMG}/${size}${path}`
}

export function stillUrl(path: string | null, size = 'w300'): string {
  if (!path) return ''
  return `${TMDB_IMG}/${size}${path}`
}

// ─── Trending ────────────────────────────────────────────────

export async function getTrending(
  mediaType: 'movie' | 'tv' | 'all' = 'all',
  timeWindow: 'day' | 'week' = 'week',
  page = 1
): Promise<TMDBPage<TMDBMediaItem>> {
  const key = `trending:${mediaType}:${timeWindow}:${page}`
  const cached = getCached<TMDBPage<TMDBMediaItem>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMediaItem>>(
    `/trending/${mediaType}/${timeWindow}`,
    { page: String(page) }
  )
  setCache(key, data)
  return data
}

// ─── Popular ─────────────────────────────────────────────────

export async function getPopularMovies(page = 1): Promise<TMDBPage<TMDBMovie>> {
  const key = `popular:movie:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/movie/popular', { page: String(page) })
  setCache(key, data)
  return data
}

export async function getPopularTvShows(page = 1): Promise<TMDBPage<TMDBTvShow>> {
  const key = `popular:tv:${page}`
  const cached = getCached<TMDBPage<TMDBTvShow>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBTvShow>>('/tv/popular', { page: String(page) })
  setCache(key, data)
  return data
}

// ─── Now Playing / Upcoming / On The Air ─────────────────────

export async function getNowPlayingMovies(page = 1): Promise<TMDBPage<TMDBMovie>> {
  const key = `nowplaying:movie:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/movie/now_playing', { page: String(page) })
  setCache(key, data)
  return data
}

export async function getUpcomingMovies(page = 1): Promise<TMDBPage<TMDBMovie>> {
  const key = `upcoming:movie:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/movie/upcoming', { page: String(page) })
  setCache(key, data)
  return data
}

export async function getOnTheAirTvShows(page = 1): Promise<TMDBPage<TMDBTvShow>> {
  const key = `ontheair:tv:${page}`
  const cached = getCached<TMDBPage<TMDBTvShow>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBTvShow>>('/tv/on_the_air', { page: String(page) })
  setCache(key, data)
  return data
}

// ─── Discover by genre ───────────────────────────────────────

export async function discoverMoviesByGenre(
  genreId: number,
  page = 1
): Promise<TMDBPage<TMDBMovie>> {
  const key = `discover:movie:${genreId}:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/discover/movie', {
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
    'vote_count.gte': '100',
    page: String(page)
  })
  setCache(key, data)
  return data
}

export async function discoverTvByGenre(
  genreId: number,
  page = 1
): Promise<TMDBPage<TMDBTvShow>> {
  const key = `discover:tv:${genreId}:${page}`
  const cached = getCached<TMDBPage<TMDBTvShow>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBTvShow>>('/discover/tv', {
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
    'vote_count.gte': '100',
    page: String(page)
  })
  setCache(key, data)
  return data
}

// ─── Discover with filters (genre / year / sort / rating / cast) ─

export interface DiscoverParams {
  type: MediaType
  genres?: number[]
  year?: number
  sortBy?: string
  minRating?: number
  withCast?: number
  page?: number
}

export async function discoverMedia(params: DiscoverParams): Promise<TMDBPage<TMDBMediaItem>> {
  const { type, genres, year, sortBy = 'popularity.desc', minRating, withCast, page = 1 } = params

  const q: Record<string, string> = {
    sort_by: sortBy,
    page: String(page),
    include_adult: 'false'
  }
  // Multiple genres are OR-joined (titles matching ANY) — friendlier than AND.
  if (genres && genres.length) q.with_genres = genres.join('|')
  if (year) q[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = String(year)
  if (typeof minRating === 'number' && minRating > 0) {
    q['vote_average.gte'] = String(minRating)
    q['vote_count.gte'] = '50'
  }
  // A vote floor keeps rating-sorted results from surfacing obscure 10/10s.
  if (sortBy.startsWith('vote_average') && !q['vote_count.gte']) q['vote_count.gte'] = '200'
  if (withCast) q[type === 'movie' ? 'with_cast' : 'with_people'] = String(withCast)

  const key = `discover:${type}:${JSON.stringify(q)}`
  const cached = getCached<TMDBPage<TMDBMediaItem>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMediaItem>>(`/discover/${type}`, q)
  // /discover omits media_type on items — tag it so cards route correctly.
  data.results = data.results.map((r) => ({ ...r, media_type: type })) as TMDBMediaItem[]
  setCache(key, data)
  return data
}

export async function getGenreList(type: MediaType): Promise<TMDBGenre[]> {
  const key = `genres:${type}`
  const cached = getCached<TMDBGenre[]>(key)
  if (cached) return cached

  const data = await tmdbFetch<{ genres: TMDBGenre[] }>(`/genre/${type}/list`)
  setCache(key, data.genres, 24 * 60 * 60 * 1000)
  return data.genres
}

export async function searchPeople(query: string, page = 1): Promise<TMDBPage<TMDBPerson>> {
  const key = `search:person:${query}:${page}`
  const cached = getCached<TMDBPage<TMDBPerson>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBPerson>>('/search/person', {
    query,
    page: String(page),
    include_adult: 'false'
  })
  setCache(key, data, 2 * 60 * 1000)
  return data
}

// ─── Top Rated ───────────────────────────────────────────────

export async function getTopRatedMovies(page = 1): Promise<TMDBPage<TMDBMovie>> {
  const key = `toprated:movie:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/movie/top_rated', { page: String(page) })
  setCache(key, data)
  return data
}

export async function getTopRatedTvShows(page = 1): Promise<TMDBPage<TMDBTvShow>> {
  const key = `toprated:tv:${page}`
  const cached = getCached<TMDBPage<TMDBTvShow>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBTvShow>>('/tv/top_rated', { page: String(page) })
  setCache(key, data)
  return data
}

// ─── Search ──────────────────────────────────────────────────

export async function searchMulti(
  query: string,
  page = 1
): Promise<TMDBPage<TMDBMediaItem>> {
  const key = `search:multi:${query}:${page}`
  const cached = getCached<TMDBPage<TMDBMediaItem>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMediaItem>>('/search/multi', {
    query,
    page: String(page),
    include_adult: 'false'
  })
  // Filter to only movies and TV shows
  data.results = data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
  setCache(key, data, 2 * 60 * 1000)
  return data
}

export async function searchMovies(
  query: string,
  page = 1
): Promise<TMDBPage<TMDBMovie>> {
  const key = `search:movie:${query}:${page}`
  const cached = getCached<TMDBPage<TMDBMovie>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBMovie>>('/search/movie', {
    query,
    page: String(page),
    include_adult: 'false'
  })
  setCache(key, data, 2 * 60 * 1000)
  return data
}

export async function searchTvShows(
  query: string,
  page = 1
): Promise<TMDBPage<TMDBTvShow>> {
  const key = `search:tv:${query}:${page}`
  const cached = getCached<TMDBPage<TMDBTvShow>>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBPage<TMDBTvShow>>('/search/tv', {
    query,
    page: String(page),
    include_adult: 'false'
  })
  setCache(key, data, 2 * 60 * 1000)
  return data
}

// ─── Details ─────────────────────────────────────────────────

export async function getMovieDetails(id: number): Promise<TMDBMovie> {
  const key = `movie:${id}`
  const cached = getCached<TMDBMovie>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBMovie>(`/movie/${id}`, {
    append_to_response: 'credits,similar,recommendations,external_ids,videos'
  })
  setCache(key, data, 10 * 60 * 1000)
  return data
}

export async function getTvShowDetails(id: number): Promise<TMDBTvShow> {
  const key = `tv:${id}`
  const cached = getCached<TMDBTvShow>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBTvShow>(`/tv/${id}`, {
    append_to_response: 'credits,similar,recommendations,external_ids,videos'
  })
  setCache(key, data, 10 * 60 * 1000)
  return data
}

export async function getTvSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeason> {
  const key = `tv:${tvId}:season:${seasonNumber}`
  const cached = getCached<TMDBSeason>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`)
  setCache(key, data, 10 * 60 * 1000)
  return data
}
