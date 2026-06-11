import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import AnimeGrid from '@/components/AnimeGrid'
import { searchAnime, getTrendingAnime } from '@/services/anilist'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { AniListAnime } from '@/types'

const PER_PAGE = 24

export default function SearchPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  const [results, setResults] = useState<AniListAnime[]>([])
  const [resultsPage, setResultsPage] = useState(1)
  const [resultsHasNext, setResultsHasNext] = useState(false)

  const [trendingAnime, setTrendingAnime] = useState<AniListAnime[]>([])
  const [trendingPage, setTrendingPage] = useState(1)
  const [trendingHasNext, setTrendingHasNext] = useState(false)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const activeQuery = searchParams.get('q') || ''

  useEffect(() => {
    getTrendingAnime(1, PER_PAGE).then((res) => {
      setTrendingAnime(res.media)
      setTrendingHasNext(res.pageInfo.hasNextPage)
    })
  }, [])

  const performSearch = useCallback(async (searchQuery: string): Promise<void> => {
    if (!searchQuery.trim()) return
    setLoading(true)
    setHasSearched(true)
    try {
      const data = await searchAnime(searchQuery.trim(), 1, PER_PAGE)
      setResults(data.media)
      setResultsPage(1)
      setResultsHasNext(data.pageInfo.hasNextPage)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-search when URL params change
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      performSearch(q)
    } else {
      setHasSearched(false)
      setResults([])
    }
  }, [searchParams, performSearch])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (query.trim()) setSearchParams({ q: query.trim() })
  }

  const hasMore = hasSearched ? resultsHasNext : trendingHasNext

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return
    setLoadingMore(true)
    try {
      if (hasSearched) {
        const next = resultsPage + 1
        const data = await searchAnime(activeQuery.trim(), next, PER_PAGE)
        setResults((prev) => [...prev, ...data.media])
        setResultsPage(next)
        setResultsHasNext(data.pageInfo.hasNextPage)
      } else {
        const next = trendingPage + 1
        const data = await getTrendingAnime(next, PER_PAGE)
        setTrendingAnime((prev) => [...prev, ...data.media])
        setTrendingPage(next)
        setTrendingHasNext(data.pageInfo.hasNextPage)
      }
    } catch (error) {
      console.error('Load more failed:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, loading, hasSearched, resultsPage, trendingPage, activeQuery])

  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: loadingMore || loading })

  return (
    <div className="p-6">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for anime by title..."
            className="input-field pl-12 pr-4 py-3 text-lg"
            autoFocus
          />
        </div>
      </form>

      {/* Results */}
      {hasSearched ? (
        <AnimeGrid
          anime={results}
          loading={loading}
          title={`Results for "${activeQuery}"`}
          emptyMessage="No anime found. Try a different search term."
        />
      ) : (
        <AnimeGrid
          anime={trendingAnime}
          title="Trending Anime"
          loading={trendingAnime.length === 0}
        />
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
