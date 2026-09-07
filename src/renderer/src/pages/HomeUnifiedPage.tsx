import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KeyRound,
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
  Trophy,
  type LucideIcon
} from 'lucide-react'
import HeroSlideshow from '@/components/HeroSlideshow'
import LazyMediaRow from '@/components/LazyMediaRow'
import ProviderRow from '@/components/ProviderRow'
import AnimeRow from '@/components/AnimeRow'
import ContinueWatchingRow from '@/components/ContinueWatchingRow'
import { useContinueWatching } from '@/hooks/useContinueWatching'
import {
  getTrending,
  getPopularMovies,
  getPopularTvShows,
  getTopRatedMovies,
  getNowPlayingMovies,
  getOnTheAirTvShows,
  discoverMoviesByGenre,
  isTmdbApiKeyConfigured
} from '@/services/tmdb'
import { getTrendingAnime, getPopularAnime, getSeasonAnime, getCurrentSeason } from '@/services/anilist'
import type { TMDBMediaItem, TMDBMovie, TMDBTvShow, AniListAnime } from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem

interface PageResult {
  results: AnyMedia[]
  page: number
  total_pages: number
}

const fetchTrendingDay = (page: number): Promise<PageResult> => getTrending('all', 'day', page)

const ROWS: { key: string; title: string; Icon: LucideIcon; fetchPage: (p: number) => Promise<PageResult> }[] = [
  { key: 'popularMovies', title: 'Popular Movies', Icon: Film, fetchPage: getPopularMovies },
  { key: 'popularTv', title: 'Popular Series', Icon: Tv, fetchPage: getPopularTvShows },
  { key: 'nowPlaying', title: 'In Cinemas Now', Icon: Clapperboard, fetchPage: getNowPlayingMovies },
  { key: 'onTheAir', title: 'On The Air', Icon: Radio, fetchPage: getOnTheAirTvShows },
  { key: 'topRated', title: 'Top Rated', Icon: Award, fetchPage: getTopRatedMovies },
  { key: 'action', title: 'Action', Icon: Swords, fetchPage: (p) => discoverMoviesByGenre(28, p) },
  { key: 'comedy', title: 'Comedy', Icon: Laugh, fetchPage: (p) => discoverMoviesByGenre(35, p) },
  { key: 'sciFi', title: 'Sci-Fi', Icon: Rocket, fetchPage: (p) => discoverMoviesByGenre(878, p) },
  { key: 'horror', title: 'Horror', Icon: Ghost, fetchPage: (p) => discoverMoviesByGenre(27, p) }
]

/**
 * The unified home. One surface for both catalogues: anime and film/TV resume
 * positions merge into a single Continue Watching row, and discovery follows.
 */
export default function HomeUnifiedPage(): JSX.Element {
  const navigate = useNavigate()
  const [heroItems, setHeroItems] = useState<TMDBMediaItem[]>([])
  const [keyMissing, setKeyMissing] = useState(false)

  const resume = useContinueWatching('all')

  // Anime picks sit on Home as peers of the film and series rows.
  const [trendingAnime, setTrendingAnime] = useState<AniListAnime[]>([])
  const [popularAnime, setPopularAnime] = useState<AniListAnime[]>([])
  const [seasonAnime, setSeasonAnime] = useState<AniListAnime[]>([])
  const [animeLoading, setAnimeLoading] = useState(true)
  const season = getCurrentSeason()

  useEffect(() => {
    isTmdbApiKeyConfigured().then((hasKey) => {
      setKeyMissing(!hasKey)
      if (!hasKey) return
      getTrending('all', 'day', 1)
        .then((t) => setHeroItems(t.results))
        .catch(() => setHeroItems([]))
    })

    Promise.allSettled([
      getTrendingAnime(1, 20),
      getPopularAnime(1, 20),
      getSeasonAnime(season.season, season.year, 1, 20)
    ])
      .then(([t, p, s]) => {
        if (t.status === 'fulfilled') setTrendingAnime(t.value.media)
        if (p.status === 'fulfilled') setPopularAnime(p.value.media)
        if (s.status === 'fulfilled') setSeasonAnime(s.value.media)
      })
      .finally(() => setAnimeLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pb-20">
      {/* Full-bleed key art, edge to edge under the floating nav. */}
      <HeroSlideshow items={heroItems} />

      <div className="px-8 space-y-9 mt-8">
        {keyMissing && (
          <div className="flex items-center justify-between bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
            <p className="text-dark-200 text-sm flex items-center gap-2">
              <KeyRound size={15} className="text-accent-light" />
              Add a TMDB key to bring films and series in. Anime works without one.
            </p>
            <button
              onClick={() => navigate('/movies/settings')}
              className="text-sm text-accent-light hover:text-white transition-colors"
            >
              Add key
            </button>
          </div>
        )}

        {/* Renders a skeleton while the database answers, so the rows below it
            never get shoved down once the real row arrives. */}
        <ContinueWatchingRow
          items={resume.items}
          loading={resume.loading}
          onRemove={resume.remove}
        />

        {!keyMissing && (
          <>
            <LazyMediaRow
              title="Trending Today"
              Icon={TrendingUp}
              maxItems={20}
              fetchPage={fetchTrendingDay}
            />
            <ProviderRow />
          </>
        )}

        <AnimeRow title="Trending Anime" Icon={Flame} anime={trendingAnime} loading={animeLoading} />

        {!keyMissing &&
          ROWS.slice(0, 4).map((row) => (
            <LazyMediaRow
              key={row.key}
              title={row.title}
              Icon={row.Icon}
              maxItems={20}
              fetchPage={row.fetchPage}
            />
          ))}

        <AnimeRow
          title={`Anime This Season · ${season.season[0]}${season.season.slice(1).toLowerCase()} ${season.year}`}
          Icon={Sparkles}
          anime={seasonAnime}
          loading={animeLoading}
        />

        {!keyMissing &&
          ROWS.slice(4).map((row) => (
            <LazyMediaRow
              key={row.key}
              title={row.title}
              Icon={row.Icon}
              maxItems={20}
              fetchPage={row.fetchPage}
            />
          ))}

        <AnimeRow
          title="All-Time Popular Anime"
          Icon={Trophy}
          anime={popularAnime}
          loading={animeLoading}
        />
      </div>
    </div>
  )
}
