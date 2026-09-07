import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Compass, Sparkles, X } from 'lucide-react'
import MediaGrid from '@/components/MediaGrid'
import FilterBar, { type DiscoverFilters } from '@/components/FilterBar'
import { discoverMedia } from '@/services/tmdb'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem, MediaType, AniListAnime } from '@/types'

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

  // Clearing every filter but the media type. Gives the empty state something
  // actionable to offer instead of a dead end.
  function clearFilters(): void {
    setSearchParams({ type: filters.type }, { replace: true })
  }

  const hasActiveFilters =
    filters.genres.length > 0 || !!filters.year || filters.minRating > 0 || !!filters.cast

  const [results, setResults] = useState<AnyMedia[]>([])
  const [pageNum, setPageNum] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  // Starts true so the first paint shows skeletons, not a flash of "no results".
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)


  const fetchPageData = useCallback(
    async (page: number): Promise<{ results: AnyMedia[]; total_pages: number }> => {
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
    [filters]
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



  const heading = filters.cast
      ? `${filters.type === 'movie' ? 'Movies' : 'TV shows'} with ${filters.cast.name}`
      : `Browse ${filters.type === 'movie' ? 'Movies' : 'TV Shows'}`

  return (
    <div className="p-6">
      {/* Filters */}
      <FilterBar filters={filters} onChange={patchFilters} searchMode={false} />

      <div className="flex items-center gap-2 mt-6 mb-4">
        <Compass size={20} className="text-accent-light" />
        <h2 className="text-xl font-bold text-white">{heading}</h2>
      </div>

      {/* Results */}
      <MediaGrid
        media={results}
        loading={loading}
        emptyTitle={
'Nothing matches these filters'
        }
        emptyHint="Try removing a genre, widening the year, or lowering the minimum rating."
        emptyAction={
          hasActiveFilters ? (
            <button onClick={clearFilters} className="btn-primary mt-4 mx-auto">
              Clear filters
            </button>
          ) : undefined
        }
      />

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
