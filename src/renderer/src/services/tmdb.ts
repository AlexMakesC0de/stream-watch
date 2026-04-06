import type { TMDBMovie, TMDBTvShow, TMDBPage, TMDBMediaItem, TMDBSeason } from '@/types'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string
const TMDB_BASE = 'https://api.themoviedb.org/3'
export const TMDB_IMG = 'https://image.tmdb.org/t/p'

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
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
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
    append_to_response: 'credits,similar,recommendations,external_ids'
  })
  setCache(key, data, 10 * 60 * 1000)
  return data
}

export async function getTvShowDetails(id: number): Promise<TMDBTvShow> {
  const key = `tv:${id}`
  const cached = getCached<TMDBTvShow>(key)
  if (cached) return cached

  const data = await tmdbFetch<TMDBTvShow>(`/tv/${id}`, {
    append_to_response: 'credits,similar,recommendations,external_ids'
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
