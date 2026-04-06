import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, TrendingUp, Star, Film, Tv, RefreshCw } from 'lucide-react'
import MediaGrid from '@/components/MediaGrid'
import {
  getTrending,
  getPopularMovies,
  getPopularTvShows,
  getTopRatedMovies,
  posterUrl
} from '@/services/tmdb'
import type { TMDBMediaItem, TMDBMovie, TMDBTvShow, MediaContinueWatchingItem } from '@/types'

export default function MoviesHomePage(): JSX.Element {
  const navigate = useNavigate()
  const [trending, setTrending] = useState<TMDBMediaItem[]>([])
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([])
  const [popularTv, setPopularTv] = useState<TMDBTvShow[]>([])
  const [topRated, setTopRated] = useState<TMDBMovie[]>([])
  const [continueWatching, setContinueWatching] = useState<MediaContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    const isInitial = trending.length === 0
    if (isInitial) setLoading(true)
    setLoadError(false)

    const [trendingRes, popularMoviesRes, popularTvRes, topRatedRes, continueRes] =
      await Promise.allSettled([
        getTrending('all', 'week', 1),
        getPopularMovies(1),
        getPopularTvShows(1),
        getTopRatedMovies(1),
        window.api.getMediaContinueWatching()
      ])

    let anyFailed = false

    if (trendingRes.status === 'fulfilled') {
      setTrending(trendingRes.value.results.slice(0, 12))
    } else {
      anyFailed = true
    }

    if (popularMoviesRes.status === 'fulfilled') {
      setPopularMovies(popularMoviesRes.value.results.slice(0, 12))
    } else {
      anyFailed = true
    }

    if (popularTvRes.status === 'fulfilled') {
      setPopularTv(popularTvRes.value.results.slice(0, 12))
    } else {
      anyFailed = true
    }

    if (topRatedRes.status === 'fulfilled') {
      setTopRated(topRatedRes.value.results.slice(0, 12))
    } else {
      anyFailed = true
    }

    if (continueRes.status === 'fulfilled') {
      setContinueWatching(continueRes.value as MediaContinueWatchingItem[])
    }

    setLoadError(anyFailed)
    setLoading(false)
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-6 space-y-8">
      {/* Error banner */}
      {loadError && !loading && (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">Some sections failed to load. Check your internet connection.</p>
          <button onClick={loadData} className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Play size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-white">Continue Watching</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {continueWatching.map((item) => {
              const watchPath = item.media_type === 'movie'
                ? `/movies/watch/movie/${item.tmdb_id}`
                : `/movies/watch/tv/${item.tmdb_id}/${item.last_season || 1}/${item.last_episode || 1}`
              return (
                <div
                  key={`${item.media_type}-${item.tmdb_id}`}
                  onClick={() => navigate(watchPath)}
                  className="flex items-center gap-3 bg-dark-900 rounded-lg overflow-hidden cursor-pointer
                             hover:bg-dark-800 transition-colors group"
                >
                  <img
                    src={posterUrl(item.poster_path, 'w92')}
                    alt={item.title}
                    className="w-16 h-20 object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 pr-3 py-2">
                    <h3 className="text-sm font-medium text-white truncate">{item.title}</h3>
                    <p className="text-xs text-dark-400 mt-0.5">
                      {item.media_type === 'tv'
                        ? `S${item.last_season} E${item.last_episode}`
                        : 'Movie'}
                      {' · '}
                      {formatTime(item.watched_seconds)} / {formatTime(item.total_seconds)}
                    </p>
                    <div className="progress-bar mt-2">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${(item.watched_seconds / Math.max(item.total_seconds, 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <Play
                    size={20}
                    className="text-accent opacity-0 group-hover:opacity-100 transition-opacity mr-3"
                    fill="currentColor"
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Trending */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">Trending This Week</h2>
        </div>
        <MediaGrid media={trending} loading={loading} />
      </section>

      {/* Popular Movies */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Film size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">Popular Movies</h2>
        </div>
        <MediaGrid media={popularMovies} loading={loading} />
      </section>

      {/* Popular TV Shows */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Tv size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">Popular TV Shows</h2>
        </div>
        <MediaGrid media={popularTv} loading={loading} />
      </section>

      {/* Top Rated */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Star size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">Top Rated Movies</h2>
        </div>
        <MediaGrid media={topRated} loading={loading} />
      </section>
    </div>
  )
}
