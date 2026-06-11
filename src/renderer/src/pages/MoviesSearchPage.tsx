import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Compass } from 'lucide-react'
import MediaGrid from '@/components/MediaGrid'
import FilterBar, { type DiscoverFilters } from '@/components/FilterBar'
import { searchMovies, searchTvShows, discoverMedia } from '@/services/tmdb'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem, MediaType } from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem

// Map the friendly sort key to a TMDB sort_by string (date field differs by type).
function sortByParam(key: DiscoverFilters['sortBy'], type: MediaType): string {
  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date'
  switch (key) {
    case 'rating':
      return 'vote_average.desc'
    case 'newest':
      return `${dateField}.desc`
    case 'oldest':
      return `${dateField}.asc`
    default:
      return 'popularity.desc'
  }
}

export default function MoviesSearchPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Filters live in the URL (single source of truth). Deriving them from the
  // query string — rather than seeding a separate state once — means a removal
  // actually sticks: pressing Back can't resurrect a stale chip because there's
  // no out-of-sync copy to fall back to.
  const filters: DiscoverFilters = useMemo(() => {
    const genres = (searchParams.get('genres') || '').split(',').filter(Boolean).map(Number)
    const withCast = searchParams.get('withCast')
    const castName = searchParams.get('castName')
    const sort = searchParams.get('sort') as DiscoverFilters['sortBy'] | null
    return {
      type: searchParams.get('type') === 'tv' ? 'tv' : 'movie',
      genres,
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
      sortBy: sort || 'popular',
      minRating: searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!) : 0,
      cast: withCast && castName ? { id: parseInt(withCast), name: castName } : null
    }
  }, [searchParams])

  function patchFilters(patch: Partial<DiscoverFilters>): void {
    const next = { ...filters, ...patch }
    const params: Record<string, string> = { type: next.type }
    if (next.genres.length) params.genres = next.genres.join(',')
    if (next.year) params.year = String(next.year)
    if (next.sortBy !== 'popular') params.sort = next.sortBy
    if (next.minRating) params.minRating = String(next.minRating)
    if (next.cast) {
      params.withCast = String(next.cast.id)
      params.castName = next.cast.name
    }
    // replace: filter tweaks shouldn't pile up as history entries.
    setSearchParams(params, { replace: true })
  }

  const [results, setResults] = useState<AnyMedia[]>([])
  const [pageNum, setPageNum] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Debounce the title query so we don't fire a search every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const searchMode = debouncedQuery.length > 0

  const fetchPageData = useCallback(
    async (page: number): Promise<{ results: AnyMedia[]; total_pages: number }> => {
      if (searchMode) {
        const data =
          filters.type === 'movie'
            ? await searchMovies(debouncedQuery, page)
            : await searchTvShows(debouncedQuery, page)
        return { results: data.results, total_pages: data.total_pages }
      }
      const data = await discoverMedia({
        type: filters.type,
        genres: filters.genres,
        year: filters.year ?? undefined,
        sortBy: sortByParam(filters.sortBy, filters.type),
        minRating: filters.minRating,
        withCast: filters.cast?.id,
        page
      })
      return { results: data.results, total_pages: data.total_pages }
    },
    [searchMode, debouncedQuery, filters]
  )

  // Reset + load page 1 whenever the query or filters change.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setResults([])
    setPageNum(1)
    fetchPageData(1)
      .then((d) => {
        if (cancelled) return
        setResults(d.results)
        setTotalPages(d.total_pages)
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchPageData])

  const hasMore = pageNum < totalPages

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || pageNum >= totalPages) return
    setLoadingMore(true)
    try {
      const next = pageNum + 1
      const d = await fetchPageData(next)
      setResults((prev) => [...prev, ...d.results])
      setPageNum(next)
    } catch {
      /* ignore append errors */
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, loading, pageNum, totalPages, fetchPageData])

  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: loading || loadingMore })

  const heading = searchMode
    ? `Results for “${debouncedQuery}”`
    : filters.cast
      ? `${filters.type === 'movie' ? 'Movies' : 'TV shows'} with ${filters.cast.name}`
      : `Browse ${filters.type === 'movie' ? 'Movies' : 'TV Shows'}`

  return (
    <div className="p-6">
      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & TV shows by title…"
          className="w-full pl-11 pr-4 py-3 bg-dark-900 border border-dark-800 rounded-xl
                     text-white placeholder:text-dark-500 focus:outline-none focus:border-accent
                     transition-colors"
          autoFocus
        />
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={patchFilters} searchMode={searchMode} />
      {searchMode && (
        <p className="text-xs text-dark-500 mt-2">
          Filters apply when browsing — clear the search box to use genre, year, sort & actor.
        </p>
      )}

      {/* Heading */}
      <div className="flex items-center gap-2 mt-6 mb-4">
        {searchMode ? (
          <Search size={20} className="text-accent" />
        ) : (
          <Compass size={20} className="text-accent" />
        )}
        <h2 className="text-xl font-bold text-white">{heading}</h2>
      </div>

      {/* Results */}
      <MediaGrid media={results} loading={loading} />

      {/* Infinite-scroll sentinel + loader */}
      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="animate-spin w-7 h-7 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
