import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Loader2,
  Flame,
  Clapperboard,
  CalendarClock,
  Award,
  Radio,
  Swords,
  Laugh,
  Drama,
  Ghost,
  Rocket,
  Sparkles,
  Fingerprint,
  BookOpen,
  Tv,
  Trophy,
  type LucideIcon
} from 'lucide-react'
import LazyMediaRow from '@/components/LazyMediaRow'
import AnimeRow from '@/components/AnimeRow'
import MediaGrid from '@/components/MediaGrid'
import AnimeGrid from '@/components/AnimeGrid'
import ContinueWatchingRow from '@/components/ContinueWatchingRow'
import SearchSurface from '@/components/SearchSurface'
import BrowseFilters, {
  EMPTY_FILTERS,
  countActive,
  type BrowseFilterState
} from '@/components/BrowseFilters'
import { useContinueWatching } from '@/hooks/useContinueWatching'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import {
  getPopularMovies,
  discoverMedia,
  getPopularTvShows,
  getNowPlayingMovies,
  getUpcomingMovies,
  getOnTheAirTvShows,
  getTopRatedMovies,
  getTopRatedTvShows,
  discoverMoviesByGenre,
  discoverTvByGenre,
} from '@/services/tmdb'
import {
  getTrendingAnime,
  getPopularAnime,
  discoverAnime,
  getSeasonAnime,
  getCurrentSeason,
  getNextSeason,
} from '@/services/anilist'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem, AniListAnime } from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem
export type BrowseType = 'movie' | 'tv' | 'anime'

interface PageResult {
  results: AnyMedia[]
  page: number
  total_pages: number
}

interface RowDef {
  key: string
  title: string
  Icon: LucideIcon
  fetchPage?: (page: number) => Promise<PageResult>
  fetchAnime?: (page: number) => Promise<AniListAnime[]>
}

const HEADINGS: Record<BrowseType, string> = {
  movie: 'Movies',
  tv: 'Series',
  anime: 'Anime'
}

const MOVIE_ROWS: RowDef[] = [
  { key: 'popular', title: 'Popular Films', Icon: Flame, fetchPage: getPopularMovies },
  { key: 'now', title: 'In Cinemas Now', Icon: Clapperboard, fetchPage: getNowPlayingMovies },
  { key: 'upcoming', title: 'Coming Soon', Icon: CalendarClock, fetchPage: getUpcomingMovies },
  { key: 'top', title: 'Top Rated Films', Icon: Award, fetchPage: getTopRatedMovies },
  { key: 'action', title: 'Action', Icon: Swords, fetchPage: (p) => discoverMoviesByGenre(28, p) },
  { key: 'comedy', title: 'Comedy', Icon: Laugh, fetchPage: (p) => discoverMoviesByGenre(35, p) },
  { key: 'drama', title: 'Drama', Icon: Drama, fetchPage: (p) => discoverMoviesByGenre(18, p) },
  { key: 'scifi', title: 'Science Fiction', Icon: Rocket, fetchPage: (p) => discoverMoviesByGenre(878, p) },
  { key: 'horror', title: 'Horror', Icon: Ghost, fetchPage: (p) => discoverMoviesByGenre(27, p) },
  { key: 'animation', title: 'Animation', Icon: Sparkles, fetchPage: (p) => discoverMoviesByGenre(16, p) },
  { key: 'doc', title: 'Documentary', Icon: BookOpen, fetchPage: (p) => discoverMoviesByGenre(99, p) }
]

const TV_ROWS: RowDef[] = [
  { key: 'popular', title: 'Popular Series', Icon: Flame, fetchPage: getPopularTvShows },
  { key: 'air', title: 'On The Air', Icon: Radio, fetchPage: getOnTheAirTvShows },
  { key: 'top', title: 'Top Rated Series', Icon: Award, fetchPage: getTopRatedTvShows },
  { key: 'drama', title: 'Drama', Icon: Drama, fetchPage: (p) => discoverTvByGenre(18, p) },
  { key: 'comedy', title: 'Comedy', Icon: Laugh, fetchPage: (p) => discoverTvByGenre(35, p) },
  { key: 'crime', title: 'Crime', Icon: Fingerprint, fetchPage: (p) => discoverTvByGenre(80, p) },
  { key: 'actadv', title: 'Action & Adventure', Icon: Swords, fetchPage: (p) => discoverTvByGenre(10759, p) },
  { key: 'scifi', title: 'Sci-Fi & Fantasy', Icon: Rocket, fetchPage: (p) => discoverTvByGenre(10765, p) },
  { key: 'doc', title: 'Documentary', Icon: BookOpen, fetchPage: (p) => discoverTvByGenre(99, p) },
  { key: 'anim', title: 'Animation', Icon: Sparkles, fetchPage: (p) => discoverTvByGenre(16, p) }
]

function animeRows(): RowDef[] {
  const cur = getCurrentSeason()
  const next = getNextSeason()
  return [
    { key: 'trending', title: 'Trending Now', Icon: Flame, fetchAnime: async (p) => (await getTrendingAnime(p, 20)).media },
    { key: 'popular', title: 'All-Time Popular', Icon: Trophy, fetchAnime: async (p) => (await getPopularAnime(p, 20)).media },
    {
      key: 'season',
      title: `This Season · ${cur.season[0]}${cur.season.slice(1).toLowerCase()} ${cur.year}`,
      Icon: Tv,
      fetchAnime: async (p) => (await getSeasonAnime(cur.season, cur.year, p, 20)).media
    },
    {
      key: 'next',
      title: `Next Season · ${next.season[0]}${next.season.slice(1).toLowerCase()} ${next.year}`,
      Icon: CalendarClock,
      fetchAnime: async (p) => (await getSeasonAnime(next.season, next.year, p, 20)).media
    }
  ]
}

/** One anime row that loads itself, so rows stay independent like the TMDB ones. */
function LazyAnimeRow({ row }: { row: RowDef }): JSX.Element {
  const [items, setItems] = useState<AniListAnime[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    row
      .fetchAnime?.(1)
      .then((m) => !cancelled && setItems(m))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [row])
  return <AnimeRow title={row.title} Icon={row.Icon} anime={items} loading={loading} />
}

/**
 * The browse surface for every catalogue. Films, series and anime all get the
 * same shape: search, resume row, curated rows, then an endless list — rather
 * than one page ending after twenty items with nowhere to go.
 */
export default function BrowsePage({ type }: { type: BrowseType }): JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [debounced, setDebounced] = useState(urlQuery)

  const resume = useContinueWatching(type)
  const rows = useMemo(() => {
    if (type === 'movie') return MOVIE_ROWS
    if (type === 'tv') return TV_ROWS
    return animeRows()
  }, [type])

  // Keep the query in the URL so a search survives Back.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = query.trim()
      setDebounced(next)
      // Merge, never replace: this used to hand setSearchParams a fresh object
      // and wipe every filter in the URL the moment the page mounted.
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) p.set('q', next)
          else p.delete('q')
          return p
        },
        { replace: true }
      )
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const searching = debounced.length > 0

  // Filters ride in the URL so Back restores them and a link reproduces the view.
  const filters: BrowseFilterState = useMemo(() => {
    const p = searchParams
    const ids = (p.get('genres') || '').split(',').filter(Boolean).map(Number)
    const names = (p.get('g') || '').split(',').filter(Boolean)
    const castId = p.get('withCast')
    const castName = p.get('castName')
    return {
      genreIds: ids,
      genreNames: names,
      year: p.get('year') ? parseInt(p.get('year')!) : null,
      minRating: p.get('minRating') ? parseInt(p.get('minRating')!) : 0,
      sortBy: (p.get('sort') as BrowseFilterState['sortBy']) || 'popular',
      cast: castId && castName ? { id: parseInt(castId), name: castName } : null
    }
  }, [searchParams])

  const activeFilters = countActive(filters)

  function patchFilters(patch: Partial<BrowseFilterState>): void {
    const next = { ...filters, ...patch }
    const out: Record<string, string> = {}
    const q = query.trim()
    if (q) out.q = q
    if (next.genreIds.length) out.genres = next.genreIds.join(',')
    if (next.genreNames.length) out.g = next.genreNames.join(',')
    if (next.year) out.year = String(next.year)
    if (next.minRating) out.minRating = String(next.minRating)
    if (next.sortBy !== 'popular') out.sort = next.sortBy
    if (next.cast) {
      out.withCast = String(next.cast.id)
      out.castName = next.cast.name
    }
    setSearchParams(out, { replace: true })
  }

  function resetFilters(): void {
    const q = query.trim()
    setSearchParams(q ? { q } : {}, { replace: true })
  }

  // ── The endless list under the rows (or the search results) ──────────
  const [items, setItems] = useState<(AnyMedia | AniListAnime)[]>([])
  // Which catalogue `items` actually holds. Route changes swap `type` a render
  // before the refetch clears the list, and feeding TMDB objects to AnimeCard
  // (or the reverse) throws during render and blanks the app.
  const [itemsType, setItemsType] = useState<BrowseType>(type)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [appending, setAppending] = useState(false)

  const filtered = activeFilters > 0

  const fetchList = useCallback(
    async (p: number): Promise<{ items: (AnyMedia | AniListAnime)[]; more: boolean }> => {
      if (type === 'anime') {
        const res = filtered
          ? await discoverAnime({
              genres: filters.genreNames,
              year: filters.year ?? undefined,
              minScore: filters.minRating || undefined,
              sort:
                filters.sortBy === 'rating'
                  ? 'SCORE_DESC'
                  : filters.sortBy === 'newest'
                    ? 'START_DATE_DESC'
                    : filters.sortBy === 'oldest'
                      ? 'START_DATE'
                      : 'POPULARITY_DESC',
              page: p
            })
          : await getPopularAnime(p, 24)
        return { items: res.media, more: res.pageInfo.hasNextPage }
      }
      if (filtered) {
        const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date'
        const sortBy =
          filters.sortBy === 'rating'
            ? 'vote_average.desc'
            : filters.sortBy === 'newest'
              ? `${dateField}.desc`
              : filters.sortBy === 'oldest'
                ? `${dateField}.asc`
                : 'popularity.desc'
        const res = await discoverMedia({
          type,
          genres: filters.genreIds,
          year: filters.year ?? undefined,
          minRating: filters.minRating,
          withCast: filters.cast?.id,
          sortBy,
          page: p
        })
        return { items: res.results, more: p < res.total_pages }
      }
      const res = type === 'movie' ? await getPopularMovies(p) : await getPopularTvShows(p)
      return { items: res.results, more: p < res.total_pages }
    },
    [type, filtered, filters]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setItems([])
    setPage(1)
    fetchList(1)
      .then((d) => {
        if (cancelled) return
        setItems(d.items)
        setItemsType(type)
        setHasMore(d.more)
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fetchList])

  const loadMore = useCallback(async () => {
    if (appending || loading || !hasMore) return
    setAppending(true)
    try {
      const next = page + 1
      const d = await fetchList(next)
      // AniList repeats entries across pages more than TMDB does; de-dupe by id.
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...d.items.filter((i) => !seen.has(i.id))]
      })
      setPage(next)
      setHasMore(d.more)
    } catch {
      setHasMore(false)
    } finally {
      setAppending(false)
    }
  }, [appending, loading, hasMore, page, fetchList])

  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: loading || appending })

  // Never hand a grid the wrong catalogue, even for a single frame.
  const safeItems = itemsType === type ? items : []

  const listHeading =
    type === 'movie' ? 'All Films' : type === 'tv' ? 'All Series' : 'All Anime'

  return (
    <div className="px-8 py-7 pb-20 space-y-9">
      <h1 className="text-2xl font-bold text-white">{HEADINGS[type]}</h1>

      {/* One search UI, shared with the standalone search route. When it has a
          query it takes over the page; otherwise it is just the field. */}
      <SearchSurface
        scope={type}
        query={query}
        onQueryChange={setQuery}
        showIdleState={false}
        onScopeChange={(next) => {
          const path = next === 'movie' ? '/movies' : next === 'tv' ? '/series' : '/anime'
          navigate(`${path}?q=${encodeURIComponent(query.trim())}`)
        }}
      />

      {/* Filters live on the page itself, always reachable without typing. */}
      {!searching && (
        <BrowseFilters
          kind={type}
          value={filters}
          onChange={patchFilters}
          onReset={resetFilters}
        />
      )}

      {/* Rows and the resume strip only make sense when you are browsing. */}
      {!searching && !filtered && (
        <>
          <ContinueWatchingRow
            items={resume.items}
            loading={resume.loading}
            onRemove={resume.remove}
          />
          {rows.map((row) =>
            row.fetchAnime ? (
              <LazyAnimeRow key={row.key} row={row} />
            ) : (
              <LazyMediaRow
                key={row.key}
                title={row.title}
                Icon={row.Icon}
                maxItems={20}
                fetchPage={row.fetchPage!}
              />
            )
          )}
        </>
      )}

      {/* The endless list: popular by default, the filtered result when any
          filter is on. */}
      {!searching && (
        <section>
          <h2 className="text-[17px] font-semibold text-white mb-4">
            {filtered ? `Filtered ${HEADINGS[type]}` : listHeading}
          </h2>
          {type === 'anime' ? (
            <AnimeGrid
              anime={safeItems as AniListAnime[]}
              loading={loading}
              emptyMessage="Nothing matches these filters"
            />
          ) : (
            <MediaGrid
              media={safeItems as AnyMedia[]}
              loading={loading}
              emptyTitle="Nothing matches these filters"
              emptyHint="Try removing a genre, widening the year, or lowering the minimum rating."
            />
          )}

          {hasMore && <div ref={sentinelRef} className="h-1" />}
          {appending && (
            <div className="flex justify-center py-8">
              <Loader2 size={26} className="animate-spin text-accent-light" />
            </div>
          )}
          {!hasMore && !loading && safeItems.length > 0 && (
            <p className="text-center text-dark-500 text-sm py-8">That’s everything.</p>
          )}
        </section>
      )}
    </div>
  )
}
