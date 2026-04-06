import { useState, useEffect } from 'react'
import { Search, TrendingUp, Film, Tv } from 'lucide-react'
import MediaGrid from '@/components/MediaGrid'
import { searchMulti, getTrending } from '@/services/tmdb'
import type { TMDBMediaItem } from '@/types'

type FilterType = 'all' | 'movie' | 'tv'

export default function MoviesSearchPage(): JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBMediaItem[]>([])
  const [trending, setTrending] = useState<TMDBMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const hasSearched = query.trim().length > 0

  useEffect(() => {
    getTrending('all', 'day', 1)
      .then((data) => setTrending(data.results.slice(0, 18)))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchMulti(query.trim(), 1)
        setResults(data.results)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [query])

  const filteredResults = filter === 'all'
    ? results
    : results.filter((r) => {
        if ('media_type' in r) return r.media_type === filter
        return filter === 'movie' ? 'title' in r : 'name' in r
      })

  const filteredTrending = filter === 'all'
    ? trending
    : trending.filter((r) => {
        if ('media_type' in r) return r.media_type === filter
        return filter === 'movie' ? 'title' in r : 'name' in r
      })

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
          <MediaGrid media={filteredTrending} loading={false} />
        </div>
      )}
    </div>
  )
}
