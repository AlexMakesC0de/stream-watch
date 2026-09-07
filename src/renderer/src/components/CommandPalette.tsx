import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Film, Tv, Sparkles, Star, CornerDownLeft, Loader2, X } from 'lucide-react'
import { searchMovies, searchTvShows, posterUrl } from '@/services/tmdb'
import { searchAnime } from '@/services/anilist'
import type { TMDBMovie, TMDBTvShow, AniListAnime } from '@/types'

type Kind = 'movie' | 'tv' | 'anime'
type Filter = 'all' | Kind

interface Hit {
  id: string
  kind: Kind
  title: string
  year: string
  score: number
  rating: number | null
  poster: string
  href: string
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Films' },
  { id: 'tv', label: 'Series' },
  { id: 'anime', label: 'Anime' }
]

const KIND_META: Record<Kind, { label: string; Icon: typeof Film }> = {
  movie: { label: 'Film', Icon: Film },
  tv: { label: 'Series', Icon: Tv },
  anime: { label: 'Anime', Icon: Sparkles }
}

/**
 * How strongly a title matches what was typed. Exact beats prefix, prefix beats
 * a word start, and a bare substring comes last — so "the office" surfaces the
 * show rather than every title containing the word "office".
 */
function nameScore(title: string, query: string): number {
  const t = title.toLowerCase().trim()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (t === q) return 1000
  if (t.startsWith(q)) return 800 - Math.min(t.length - q.length, 200)
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 600
  if (t.includes(q)) return 400
  // Every query word present somewhere still counts, just weakly.
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every((w) => t.includes(w))) return 250
  return 0
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element | null {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Fresh every time it opens; a palette that remembers last night's query is
  // a palette you have to clear before you can use it.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    setHits([])
    setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open || debounced.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    Promise.allSettled([
      searchMovies(debounced, 1),
      searchTvShows(debounced, 1),
      searchAnime(debounced, 1, 12)
    ])
      .then(([m, t, a]) => {
        if (cancelled) return
        const out: Hit[] = []

        if (m.status === 'fulfilled') {
          for (const item of m.value.results as TMDBMovie[]) {
            out.push({
              id: `movie-${item.id}`,
              kind: 'movie',
              title: item.title,
              year: item.release_date?.slice(0, 4) ?? '',
              score: nameScore(item.title, debounced),
              rating: item.vote_average || null,
              poster: posterUrl(item.poster_path, 'w154'),
              href: `/movies/detail/movie/${item.id}`
            })
          }
        }
        if (t.status === 'fulfilled') {
          for (const item of t.value.results as TMDBTvShow[]) {
            out.push({
              id: `tv-${item.id}`,
              kind: 'tv',
              title: item.name,
              year: item.first_air_date?.slice(0, 4) ?? '',
              score: nameScore(item.name, debounced),
              rating: item.vote_average || null,
              poster: posterUrl(item.poster_path, 'w154'),
              href: `/movies/detail/tv/${item.id}`
            })
          }
        }
        if (a.status === 'fulfilled') {
          for (const item of a.value.media as AniListAnime[]) {
            const title = item.title.english || item.title.romaji
            out.push({
              id: `anime-${item.id}`,
              kind: 'anime',
              title,
              year: item.seasonYear ? String(item.seasonYear) : '',
              score: nameScore(title, debounced),
              rating: item.averageScore ? item.averageScore / 10 : null,
              poster: item.coverImage.large,
              href: `/anime/detail/${item.id}`
            })
          }
        }

        setHits(out.filter((h) => h.score > 0).sort((x, y) => y.score - x.score))
        setActive(0)
      })
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [debounced, open])

  // The five strongest names stay called out at the top; everything else is
  // still reachable by scrolling rather than being thrown away.
  const filtered = useMemo(
    () => hits.filter((h) => filter === 'all' || h.kind === filter),
    [hits, filter]
  )
  const shown = useMemo(() => filtered.slice(0, 40), [filtered])
  const BEST = 5

  const go = useCallback(
    (hit: Hit) => {
      onClose()
      navigate(hit.href)
    },
    [navigate, onClose]
  )

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const i = FILTERS.findIndex((f) => f.id === filter)
        setFilter(FILTERS[(i + (e.shiftKey ? FILTERS.length - 1 : 1)) % FILTERS.length].id)
      } else if (e.key === 'Enter' && shown[active]) {
        e.preventDefault()
        go(shown[active])
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, shown, active, filter, go, onClose])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[14vh] px-6">
      {/* Dim and blur everything behind, and close on click-away. */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px] animate-[fadeIn_140ms_ease-out]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search everything"
        className="relative w-full max-w-2xl rounded-xl bg-dark-800 border border-dark-600
                   shadow-[0_28px_70px_-20px_rgba(0,0,0,0.95)] overflow-hidden
                   animate-[paletteIn_180ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Query */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-dark-700">
          <Search size={18} className="text-dark-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search films, series and anime…"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-dark-500 focus:outline-none"
          />
          {loading && <Loader2 size={16} className="text-dark-400 animate-spin shrink-0" />}
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-dark-400 hover:text-white hover:bg-dark-700 transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-dark-700">
          {FILTERS.map((f) => {
            const count =
              f.id === 'all' ? hits.length : hits.filter((h) => h.kind === f.id).length
            return (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id)
                  setActive(0)
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-accent text-white'
                    : 'text-dark-300 hover:text-white hover:bg-dark-700'
                }`}
              >
                {f.label}
                {debounced.length >= 2 && (
                  <span className={filter === f.id ? 'text-white/70' : 'text-dark-500'}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto overscroll-contain p-2">
          {debounced.length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-dark-500">
              Type at least two characters to search.
            </p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-dark-500">
              {loading ? 'Searching…' : `Nothing matched “${debounced}”.`}
            </p>
          ) : (
            shown.map((hit, i) => {
              const { label, Icon } = KIND_META[hit.kind]
              const isActive = i === active
              const heading =
                i === 0 ? 'Best matches' : i === BEST && shown.length > BEST ? 'More results' : null
              return (
                <div key={hit.id}>
                {heading && (
                  <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dark-500">
                    {heading}
                  </p>
                )}
                <button
                  data-active={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hit)}
                  className={`relative w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                    isActive ? 'bg-dark-700' : 'hover:bg-dark-700/60'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />
                  )}
                  <div className="w-10 h-[60px] rounded overflow-hidden bg-dark-900 shrink-0">
                    {hit.poster ? (
                      <img src={hit.poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon size={14} className="text-dark-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{hit.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-dark-400 tabular">
                      <span className="flex items-center gap-1">
                        <Icon size={11} />
                        {label}
                      </span>
                      {hit.year && <span>· {hit.year}</span>}
                      {hit.rating !== null && hit.rating > 0 && (
                        <span className="flex items-center gap-0.5">
                          · <Star size={10} className="text-yellow-400" fill="currentColor" />
                          {hit.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isActive && <CornerDownLeft size={14} className="text-dark-400 shrink-0" />}
                </button>
                </div>
              )
            })
          )}
        </div>

        {/* Hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-dark-700 text-[11px] text-dark-500">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>⇥ filter</span>
            <span>esc close</span>
          </div>
          {debounced.length >= 2 && (
            <span className="tabular">
              {shown.length} of {filtered.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
