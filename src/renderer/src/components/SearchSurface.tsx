import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X, Film, Tv, Sparkles, Loader2, type LucideIcon } from 'lucide-react'
import MediaGrid from './MediaGrid'
import AnimeGrid from './AnimeGrid'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { searchMovies, searchTvShows } from '@/services/tmdb'
import { searchAnime } from '@/services/anilist'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem, AniListAnime } from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem
export type SearchScope = 'movie' | 'tv' | 'anime'

const TABS: { id: SearchScope; label: string; Icon: LucideIcon }[] = [
  { id: 'movie', label: 'Films', Icon: Film },
  { id: 'tv', label: 'Series', Icon: Tv },
  { id: 'anime', label: 'Anime', Icon: Sparkles }
]

const PLACEHOLDER = 'Search films, series and anime by title…'

interface Counts {
  movie: number | null
  tv: number | null
  anime: number | null
}

/** Result totals per catalogue, so the tabs can say what is behind them. */
function useSearchCounts(query: string): Counts {
  const [counts, setCounts] = useState<Counts>({ movie: null, tv: null, anime: null })

  useEffect(() => {
    if (query.trim().length < 2) {
      setCounts({ movie: null, tv: null, anime: null })
      return
    }
    let cancelled = false
    Promise.allSettled([
      searchMovies(query, 1),
      searchTvShows(query, 1),
      searchAnime(query, 1, 1)
    ]).then(([m, t, a]) => {
      if (cancelled) return
      setCounts({
        movie: m.status === 'fulfilled' ? m.value.total_results : null,
        tv: t.status === 'fulfilled' ? t.value.total_results : null,
        anime: a.status === 'fulfilled' ? a.value.pageInfo.total : null
      })
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return counts
}

interface SearchSurfaceProps {
  scope: SearchScope
  query: string
  onQueryChange: (q: string) => void
  onScopeChange: (s: SearchScope) => void
  autoFocus?: boolean
  /** Show the idle prompt when there is no query. Off when a browse page owns
   *  the rest of the page — otherwise it leaves a dead gap above the rows. */
  showIdleState?: boolean
}

/**
 * The one search surface. Films, series, anime and the standalone search page
 * all render this exact component, so the layout, tabs, states and results
 * cannot drift apart the way three separate implementations did.
 */
export default function SearchSurface({
  scope,
  query,
  onQueryChange,
  onScopeChange,
  autoFocus = false,
  showIdleState = true
}: SearchSurfaceProps): JSX.Element {
  const [debounced, setDebounced] = useState(query.trim())

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])

  const active = debounced.length >= 2
  const counts = useSearchCounts(active ? debounced : '')
  const total = (counts.movie ?? 0) + (counts.tv ?? 0) + (counts.anime ?? 0)

  const [items, setItems] = useState<(AnyMedia | AniListAnime)[]>([])
  const [itemsScope, setItemsScope] = useState<SearchScope>(scope)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [appending, setAppending] = useState(false)

  const fetchPage = useCallback(
    async (p: number): Promise<{ items: (AnyMedia | AniListAnime)[]; more: boolean }> => {
      if (scope === 'anime') {
        const r = await searchAnime(debounced, p, 24)
        return { items: r.media, more: r.pageInfo.hasNextPage }
      }
      const r = scope === 'movie' ? await searchMovies(debounced, p) : await searchTvShows(debounced, p)
      return { items: r.results, more: p < r.total_pages }
    },
    [scope, debounced]
  )

  useEffect(() => {
    if (!active) {
      setItems([])
      setHasMore(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setItems([])
    setPage(1)
    fetchPage(1)
      .then((d) => {
        if (cancelled) return
        setItems(d.items)
        setItemsScope(scope)
        setHasMore(d.more)
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fetchPage, active, scope])

  const loadMore = useCallback(async () => {
    if (appending || loading || !hasMore) return
    setAppending(true)
    try {
      const next = page + 1
      const d = await fetchPage(next)
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
  }, [appending, loading, hasMore, page, fetchPage])

  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: loading || appending })

  // Never hand a grid the other catalogue's objects, even for one frame.
  const safeItems = useMemo(() => (itemsScope === scope ? items : []), [itemsScope, scope, items])

  return (
    <div className="space-y-6">
      {/* Query */}
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={PLACEHOLDER}
          autoFocus={autoFocus}
          spellCheck={false}
          className="w-full h-14 pl-12 pr-12 bg-dark-800 border border-dark-700 rounded-xl
                     text-[15px] text-white placeholder:text-dark-500
                     focus:outline-none focus:border-accent focus:bg-dark-800
                     transition-colors"
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-dark-400
                       hover:text-white hover:bg-dark-700 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Counts and catalogue tabs */}
      {active && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-dark-800 border border-dark-700">
            {TABS.map((tab) => {
              const isActive = scope === tab.id
              const count = counts[tab.id]
              return (
                <button
                  key={tab.id}
                  onClick={() => onScopeChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-accent text-white font-semibold'
                      : 'text-dark-300 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  <tab.Icon size={15} />
                  {tab.label}
                  {count !== null && (
                    <span
                      className={`text-[11px] font-semibold tabular ${
                        isActive ? 'text-white/75' : 'text-dark-500'
                      }`}
                    >
                      {count > 999 ? '999+' : count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-sm text-dark-400 tabular">
            {total > 0 ? (
              <>
                <span className="text-white font-medium">{total.toLocaleString()}</span> results for{' '}
                <span className="text-white">“{debounced}”</span>
              </>
            ) : (
              <>
                No results for <span className="text-white">“{debounced}”</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Results */}
      {!active ? (
        !showIdleState ? null : (
        <div className="py-24 text-center">
          <Search size={40} className="mx-auto mb-4 text-dark-600" />
          <p className="text-dark-300 text-base font-medium">Search everything</p>
          <p className="text-dark-500 text-sm mt-1">
            Films, series and anime. Type at least two characters.
          </p>
        </div>
        )
      ) : scope === 'anime' ? (
        <AnimeGrid
          anime={safeItems as AniListAnime[]}
          loading={loading}
          emptyMessage={`Nothing matched “${debounced}”`}
        />
      ) : (
        <MediaGrid
          media={safeItems as AnyMedia[]}
          loading={loading}
          emptyTitle={`No matches for “${debounced}”`}
          emptyHint="Check the spelling, or try a shorter title."
        />
      )}

      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {appending && (
        <div className="flex justify-center py-8">
          <Loader2 size={26} className="animate-spin text-accent-light" />
        </div>
      )}
      {active && !hasMore && !loading && safeItems.length > 0 && (
        <p className="text-center text-dark-500 text-sm py-8">That’s everything.</p>
      )}
    </div>
  )
}
