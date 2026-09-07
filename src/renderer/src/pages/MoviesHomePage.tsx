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
  X,
  type LucideIcon
} from 'lucide-react'
import HeroSlideshow from '@/components/HeroSlideshow'
import LazyMediaRow from '@/components/LazyMediaRow'
import ProviderRow from '@/components/ProviderRow'
import TmdbKeySetup from '@/components/TmdbKeySetup'
import { formatTimeLeft, progressPercent } from '@/lib/time'
import {
  getTrending,
  getPopularMovies,
  getPopularTvShows,
  getTopRatedMovies,
  getNowPlayingMovies,
  getOnTheAirTvShows,
  discoverMoviesByGenre,
  posterUrl,
  backdropUrl,
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

  // Drop a title out of Continue Watching. Optimistic: hide it right away,
  // then persist — and put it back if the write fails.
  async function handleRemoveFromContinue(
    e: React.MouseEvent,
    item: MediaContinueWatchingItem
  ): Promise<void> {
    e.stopPropagation()
    const previous = continueWatching
    setContinueWatching((list) =>
      list.filter((i) => !(i.tmdb_id === item.tmdb_id && i.media_type === item.media_type))
    )
    try {
      await window.api.removeMediaFromContinueWatching(item.tmdb_id, item.media_type)
    } catch {
      setContinueWatching(previous)
    }
  }

  // No API key → this *is* the first-run experience for production builds, so
  // give it a real screen that takes the key inline instead of a banner that
  // punts to Settings. Rows would all fail without it, so don't render them.
  if (keyMissing && !checking) {
    return <TmdbKeySetup onSaved={loadData} />
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
          {/* Landscape 16:9 cards in a scrolling row — matches the rhythm of
              every other row on the page, and a still frame says more about
              where you are than a show poster does. */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {continueWatching.map((item) => {
              const watchPath = item.media_type === 'movie'
                ? `/movies/watch/movie/${item.tmdb_id}`
                : `/movies/watch/tv/${item.tmdb_id}/${item.last_season || 1}/${item.last_episode || 1}`
              const timeLeft = formatTimeLeft(item.watched_seconds, item.total_seconds)
              const still = item.backdrop_path
                ? backdropUrl(item.backdrop_path, 'w780')
                : posterUrl(item.poster_path, 'w342')
              return (
                <div
                  key={`${item.media_type}-${item.tmdb_id}`}
                  onClick={() => navigate(watchPath)}
                  className="group shrink-0 w-64 cursor-pointer"
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-dark-900">
                    {still ? (
                      <img
                        src={still}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film size={28} className="text-dark-600" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play size={34} className="text-white drop-shadow-lg" fill="currentColor" />
                    </div>

                    {/* Forgets the resume position only — episodes already
                        marked watched stay watched. */}
                    <button
                      onClick={(e) => handleRemoveFromContinue(e, item)}
                      title="Remove from Continue Watching"
                      aria-label={`Remove ${item.title} from Continue Watching`}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-dark-950/80 text-dark-300
                                 opacity-0 group-hover:opacity-100 focus:opacity-100
                                 hover:text-white hover:bg-dark-700 transition-all"
                    >
                      <X size={13} />
                    </button>

                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${progressPercent(item.watched_seconds, item.total_seconds)}%`
                        }}
                      />
                    </div>
                  </div>

                  <h3 className="mt-2 text-sm font-medium text-white truncate">{item.title}</h3>
                  <p className="text-xs text-dark-400 mt-0.5 truncate">
                    {item.media_type === 'tv'
                      ? `S${item.last_season} E${item.last_episode}`
                      : 'Movie'}
                    {timeLeft && ` · ${timeLeft}`}
                  </p>
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
