import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Flame,
  TrendingUp,
  Film,
  Tv,
  Clapperboard,
  Radio,
  Award,
  Swords,
  Laugh,
  Rocket,
  Ghost,
  Sparkles,
  KeyRound,
  type LucideIcon
} from 'lucide-react'
import HeroSlideshow from '@/components/HeroSlideshow'
import LazyMediaRow from '@/components/LazyMediaRow'
import ProviderRow from '@/components/ProviderRow'
import {
  getTrending,
  getPopularMovies,
  getPopularTvShows,
  getTopRatedMovies,
  getNowPlayingMovies,
  getOnTheAirTvShows,
  discoverMoviesByGenre,
  posterUrl,
  isTmdbApiKeyConfigured
} from '@/services/tmdb'
import type {
  TMDBMediaItem,
  TMDBMovie,
  TMDBTvShow,
  MediaContinueWatchingItem
} from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem

interface PageResult {
  results: AnyMedia[]
  page: number
  total_pages: number
}

const GENRE = { action: 28, comedy: 35, sciFi: 878, horror: 27, animation: 16 }

// Module-level fetchers → stable identity so rows don't reset on re-render.
const fetchTrendingDay = (page: number): Promise<PageResult> => getTrending('all', 'day', page)

interface RowDef {
  key: string
  title: string
  Icon: LucideIcon
  badge?: string
  ranked?: boolean
  maxItems?: number
  fetchPage: (page: number) => Promise<PageResult>
}

const ROWS: RowDef[] = [
  { key: 'top10', title: 'Today', Icon: Flame, badge: 'Top 10', ranked: true, maxItems: 10, fetchPage: fetchTrendingDay },
  { key: 'trending', title: 'Trending Today', Icon: TrendingUp, fetchPage: fetchTrendingDay },
  { key: 'popularMovies', title: 'Popular Movies', Icon: Film, fetchPage: getPopularMovies },
  { key: 'popularTv', title: 'Popular TV Shows', Icon: Tv, fetchPage: getPopularTvShows },
  { key: 'nowPlaying', title: 'Now Playing', Icon: Clapperboard, fetchPage: getNowPlayingMovies },
  { key: 'onTheAir', title: 'On The Air', Icon: Radio, fetchPage: getOnTheAirTvShows },
  { key: 'topRated', title: 'Top Rated', Icon: Award, fetchPage: getTopRatedMovies },
  { key: 'action', title: 'Action', Icon: Swords, fetchPage: (p) => discoverMoviesByGenre(GENRE.action, p) },
  { key: 'comedy', title: 'Comedy', Icon: Laugh, fetchPage: (p) => discoverMoviesByGenre(GENRE.comedy, p) },
  { key: 'sciFi', title: 'Sci-Fi', Icon: Rocket, fetchPage: (p) => discoverMoviesByGenre(GENRE.sciFi, p) },
  { key: 'horror', title: 'Horror', Icon: Ghost, fetchPage: (p) => discoverMoviesByGenre(GENRE.horror, p) },
  { key: 'animation', title: 'Animation', Icon: Sparkles, fetchPage: (p) => discoverMoviesByGenre(GENRE.animation, p) }
]

export default function MoviesHomePage(): JSX.Element {
  const navigate = useNavigate()
  const [heroItems, setHeroItems] = useState<TMDBMediaItem[]>([])
  const [continueWatching, setContinueWatching] = useState<MediaContinueWatchingItem[]>([])
  const [keyMissing, setKeyMissing] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    setChecking(true)
    const hasKey = await isTmdbApiKeyConfigured()
    setKeyMissing(!hasKey)

    const continueRes = await window.api.getMediaContinueWatching().catch(() => [])
    setContinueWatching(continueRes as MediaContinueWatchingItem[])

    if (hasKey) {
      try {
        const trending = await getTrending('all', 'day', 1)
        setHeroItems(trending.results)
      } catch {
        setHeroItems([])
      }
    }
    setChecking(false)
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // No API key → prompt, don't render rows (they'd all fail).
  if (keyMissing && !checking) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <p className="text-amber-300 text-sm flex items-center gap-2">
            <KeyRound size={15} />
            Add your TMDB API key to load Movies &amp; TV.
          </p>
          <button
            onClick={() => navigate('/movies/settings')}
            className="text-sm text-accent hover:text-accent/80 transition-colors"
          >
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Hero slideshow */}
      <HeroSlideshow items={heroItems} />

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

      {/* Top 10 Today (ranked) */}
      <LazyMediaRow
        title={ROWS[0].title}
        Icon={ROWS[0].Icon}
        badge={ROWS[0].badge}
        ranked={ROWS[0].ranked}
        maxItems={ROWS[0].maxItems}
        fetchPage={ROWS[0].fetchPage}
      />

      {/* Trending */}
      <LazyMediaRow
        title={ROWS[1].title}
        Icon={ROWS[1].Icon}
        maxItems={20}
        fetchPage={ROWS[1].fetchPage}
      />

      {/* Only on <provider> */}
      <ProviderRow />

      {/* Remaining rows — cap each genre/category at ~20 (one TMDB page) */}
      {ROWS.slice(2).map((row) => (
        <LazyMediaRow
          key={row.key}
          title={row.title}
          Icon={row.Icon}
          maxItems={20}
          fetchPage={row.fetchPage}
        />
      ))}
    </div>
  )
}
