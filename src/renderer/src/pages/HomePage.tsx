import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  TrendingUp,
  Star,
  Calendar,
  CalendarClock,
  Flame,
  Award,
  Film,
  RefreshCw
} from 'lucide-react'
import AnimeGrid from '@/components/AnimeGrid'
import { getAnimeDiscover, getCurrentSeason, getNextSeason } from '@/services/anilist'
import type { AniListAnime, ContinueWatchingItem } from '@/types'

const seasonLabel = (s: { season: string; year: number }): string =>
  `${s.season.charAt(0) + s.season.slice(1).toLowerCase()} ${s.year}`

export default function HomePage(): JSX.Element {
  const navigate = useNavigate()
  const [trending, setTrending] = useState<AniListAnime[]>([])
  const [seasonal, setSeasonal] = useState<AniListAnime[]>([])
  const [upcoming, setUpcoming] = useState<AniListAnime[]>([])
  const [popular, setPopular] = useState<AniListAnime[]>([])
  const [topRated, setTopRated] = useState<AniListAnime[]>([])
  const [movies, setMovies] = useState<AniListAnime[]>([])
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    const isInitial = trending.length === 0 && popular.length === 0
    if (isInitial) setLoading(true)
    setLoadError(false)

    const [discoverRes, continueRes] = await Promise.allSettled([
      getAnimeDiscover(18),
      window.api.getContinueWatching()
    ])

    if (discoverRes.status === 'fulfilled') {
      const d = discoverRes.value
      setTrending(d.trending)
      setSeasonal(d.seasonal)
      setUpcoming(d.upcoming)
      setPopular(d.popular)
      setTopRated(d.topRated)
      setMovies(d.movies)
    } else {
      console.error('Failed to load discover sections:', discoverRes.reason)
      setLoadError(true)
    }

    if (continueRes.status === 'fulfilled') {
      setContinueWatching(continueRes.value as ContinueWatchingItem[])
    } else {
      console.error('Failed to load continue watching:', continueRes.reason)
    }

    setLoading(false)
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const sections: { icon: JSX.Element; title: string; data: AniListAnime[] }[] = [
    { icon: <TrendingUp size={20} className="text-accent" />, title: 'Trending Now', data: trending },
    { icon: <Calendar size={20} className="text-accent" />, title: seasonLabel(getCurrentSeason()), data: seasonal },
    { icon: <CalendarClock size={20} className="text-accent" />, title: `Upcoming — ${seasonLabel(getNextSeason())}`, data: upcoming },
    { icon: <Flame size={20} className="text-accent" />, title: 'All-Time Popular', data: popular },
    { icon: <Award size={20} className="text-accent" />, title: 'Top Rated', data: topRated },
    { icon: <Film size={20} className="text-accent" />, title: 'Anime Movies', data: movies }
  ]

  return (
    <div className="p-6 space-y-8">
      {/* Error banner with retry */}
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
            {continueWatching.map((item) => (
              <div
                key={item.anilist_id}
                onClick={() =>
                  navigate(`/anime/watch/${item.anilist_id}/${item.last_episode}`)
                }
                className="flex items-center gap-3 bg-dark-900 rounded-lg overflow-hidden cursor-pointer
                           hover:bg-dark-800 transition-colors group"
              >
                <img
                  src={item.cover_image || ''}
                  alt={item.title}
                  className="w-16 h-20 object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 pr-3 py-2">
                  <h3 className="text-sm font-medium text-white truncate">{item.title}</h3>
                  <p className="text-xs text-dark-400 mt-0.5">
                    Episode {item.last_episode} · {formatTime(item.watched_seconds)} /{' '}
                    {formatTime(item.total_seconds)}
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
            ))}
          </div>
        </section>
      )}

      {/* Discover sections */}
      {sections.map((section) => (
        <section key={section.title}>
          <div className="flex items-center gap-2 mb-4">
            {section.icon}
            <h2 className="text-xl font-bold text-white">{section.title}</h2>
          </div>
          <AnimeGrid anime={section.data} loading={loading} />
        </section>
      ))}
    </div>
  )
}
