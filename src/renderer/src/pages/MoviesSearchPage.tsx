import { useState, useEffect, useCallback } from 'react'
import { Search, TrendingUp, Film, Tv } from 'lucide-react'
import MediaGrid from '@/components/MediaGrid'
import { searchMulti, getTrending } from '@/services/tmdb'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { TMDBMediaItem } from '@/types'

type FilterType = 'all' | 'movie' | 'tv'

export default function MoviesSearchPage(): JSX.Element {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  const [results, setResults] = useState<TMDBMediaItem[]>([])
  const [resultsPage, setResultsPage] = useState(1)
  const [resultsTotalPages, setResultsTotalPages] = useState(1)

  const [trending, setTrending] = useState<TMDBMediaItem[]>([])
  const [trendingPage, setTrendingPage] = useState(1)
  const [trendingTotalPages, setTrendingTotalPages] = useState(1)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const hasSearched = query.trim().length > 0

  // Initial trending
  useEffect(() => {
    getTrending('all', 'day', 1)
      .then((data) => {
        setTrending(data.results)
        setTrendingTotalPages(data.total_pages)
      })
      .catch(console.error)
  }, [])

  // Debounced search; resets to page 1
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setResultsPage(1)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchMulti(query.trim(), 1)
        setResults(data.results)
        setResultsPage(1)
        setResultsTotalPages(data.total_pages)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const hasMore = hasSearched
    ? resultsPage < resultsTotalPages
    : trendingPage < trendingTotalPages

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return
    setLoadingMore(true)
    try {
      if (hasSearched) {
        const next = resultsPage + 1
        if (next > resultsTotalPages) return
        const data = await searchMulti(query.trim(), next)
        setResults((prev) => [...prev, ...data.results])
        setResultsPage(next)
      } else {
        const next = trendingPage + 1
        if (next > trendingTotalPages) return
        const data = await getTrending('all', 'day', next)
        setTrending((prev) => [...prev, ...data.results])
        setTrendingPage(next)
      }
    } catch (err) {
      console.error('Load more failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, loading, hasSearched, resultsPage, resultsTotalPages, trendingPage, trendingTotalPages, query])

  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: loadingMore || loading })

  const applyFilter = (list: TMDBMediaItem[]): TMDBMediaItem[] =>
    filter === 'all'
      ? list
      : list.filter((r) => {
          if ('media_type' in r && r.media_type) return r.media_type === filter
          return filter === 'movie' ? 'title' in r : 'name' in r
        })

  const filteredResults = applyFilter(results)
  const filteredTrending = applyFilter(trending)

  return (
    <div className="p-6">
      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & TV shows..."
          className="w-full pl-11 pr-4 py-3 bg-dark-900 border border-dark-800 rounded-xl
                     text-white placeholder:text-dark-500 focus:outline-none focus:border-accent
                     transition-colors"
          autoFocus
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {([
          { key: 'all', label: 'All', icon: Search },
          { key: 'movie', label: 'Movies', icon: Film },
          { key: 'tv', label: 'TV Shows', icon: Tv }
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-accent/10 text-accent'
                : 'text-dark-400 hover:bg-dark-900 hover:text-dark-200'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results or trending */}
      {hasSearched ? (
        <MediaGrid media={filteredResults} loading={loading} />
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-white">Trending Today</h2>
          </div>
          <MediaGrid media={filteredTrending} loading={trending.length === 0} />
        </div>
      )}

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
