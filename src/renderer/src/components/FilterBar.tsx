import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Film, Tv, Check, X } from 'lucide-react'
import { getGenreList } from '@/services/tmdb'
import PersonPicker, { type SelectedPerson } from './PersonPicker'
import type { MediaType, TMDBGenre } from '@/types'

export interface DiscoverFilters {
  type: MediaType
  genres: number[]
  year: number | null
  sortBy: 'popular' | 'rating' | 'newest' | 'oldest'
  minRating: number
  cast: SelectedPerson | null
}

export const DEFAULT_FILTERS: DiscoverFilters = {
  type: 'movie',
  genres: [],
  year: null,
  sortBy: 'popular',
  minRating: 0,
  cast: null
}

const SORT_OPTIONS: { value: DiscoverFilters['sortBy']; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' }
]

const RATING_OPTIONS = [0, 5, 6, 7, 8]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i)

const selectCls =
  'appearance-none bg-dark-800 text-white text-sm rounded-lg pl-3 pr-8 py-1.5 ' +
  'border border-dark-700 focus:outline-none focus:border-accent cursor-pointer ' +
  'disabled:opacity-40 disabled:cursor-not-allowed'

interface FilterBarProps {
  filters: DiscoverFilters
  onChange: (patch: Partial<DiscoverFilters>) => void
  /** When the user is title-searching, discover-only controls are disabled. */
  searchMode: boolean
}

export default function FilterBar({ filters, onChange, searchMode }: FilterBarProps): JSX.Element {
  const [genreList, setGenreList] = useState<TMDBGenre[]>([])
  const [genreOpen, setGenreOpen] = useState(false)
  const genreRef = useRef<HTMLDivElement>(null)

  // Genre list depends on the chosen media type
  useEffect(() => {
    getGenreList(filters.type)
      .then(setGenreList)
      .catch(() => setGenreList([]))
  }, [filters.type])

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) setGenreOpen(false)
    }
    if (genreOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [genreOpen])

  function toggleGenre(id: number): void {
    const next = filters.genres.includes(id)
      ? filters.genres.filter((g) => g !== id)
      : [...filters.genres, id]
    onChange({ genres: next })
  }

  const Chevron = (
    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
  )

  // What's currently narrowing the results, as individually removable chips.
  // Without these you can stack four filters and have no idea which one is
  // hiding the thing you're looking for.
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (!searchMode) {
    filters.genres.forEach((id) => {
      chips.push({
        key: `genre-${id}`,
        label: genreList.find((g) => g.id === id)?.name ?? 'Genre',
        clear: () => toggleGenre(id)
      })
    })
    if (filters.year) {
      chips.push({ key: 'year', label: String(filters.year), clear: () => onChange({ year: null }) })
    }
    if (filters.minRating > 0) {
      chips.push({
        key: 'rating',
        label: `${filters.minRating}+ ★`,
        clear: () => onChange({ minRating: 0 })
      })
    }
    if (filters.sortBy !== 'popular') {
      chips.push({
        key: 'sort',
        label: SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? 'Sorted',
        clear: () => onChange({ sortBy: 'popular' })
      })
    }
    if (filters.cast) {
      chips.push({ key: 'cast', label: filters.cast.name, clear: () => onChange({ cast: null }) })
    }
  }

  function clearAll(): void {
    onChange({ genres: [], year: null, sortBy: 'popular', minRating: 0, cast: null })
  }

  return (
    <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      {/* Type toggle */}
      <div className="flex items-center bg-dark-800 rounded-lg border border-dark-700 p-0.5">
        {(['movie', 'tv'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ type: t, genres: [] })}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              filters.type === t ? 'bg-accent/15 text-accent' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            {t === 'movie' ? <Film size={14} /> : <Tv size={14} />}
            {t === 'movie' ? 'Movies' : 'TV'}
          </button>
        ))}
      </div>

      {/* Genre multi-select */}
      <div ref={genreRef} className="relative">
        <button
          onClick={() => setGenreOpen((o) => !o)}
          disabled={searchMode}
          className="flex items-center gap-1.5 bg-dark-800 text-sm rounded-lg pl-3 pr-2.5 py-1.5
                     border border-dark-700 hover:bg-dark-700 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed text-dark-200"
        >
          <span className={filters.genres.length ? 'text-accent' : ''}>
            {filters.genres.length ? `Genres (${filters.genres.length})` : 'Genre'}
          </span>
          <ChevronDown size={14} className="text-dark-400" />
        </button>
        {genreOpen && !searchMode && (
          <div className="absolute z-30 mt-1 w-56 max-h-72 overflow-y-auto bg-dark-900 border border-dark-700 rounded-lg shadow-xl p-1.5">
            {genreList.map((g) => {
              const on = filters.genres.includes(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm text-left hover:bg-dark-800"
                >
                  <span className={on ? 'text-accent' : 'text-dark-200'}>{g.name}</span>
                  {on && <Check size={14} className="text-accent" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Year */}
      <div className="relative">
        <select
          value={filters.year ?? ''}
          onChange={(e) => onChange({ year: e.target.value ? parseInt(e.target.value) : null })}
          disabled={searchMode}
          className={selectCls}
        >
          <option value="">Any year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {Chevron}
      </div>

      {/* Sort */}
      <div className="relative">
        <select
          value={filters.sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value as DiscoverFilters['sortBy'] })}
          disabled={searchMode}
          className={selectCls}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {Chevron}
      </div>

      {/* Min rating */}
      <div className="relative">
        <select
          value={filters.minRating}
          onChange={(e) => onChange({ minRating: parseInt(e.target.value) })}
          disabled={searchMode}
          className={selectCls}
        >
          {RATING_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r === 0 ? 'Any rating' : `${r}+ ★`}
            </option>
          ))}
        </select>
        {Chevron}
      </div>

      {/* Actor / cast */}
      <PersonPicker
        value={filters.cast}
        onChange={(p) => onChange({ cast: p })}
        disabled={searchMode}
      />
    </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              title={`Remove ${c.label}`}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium
                         bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
            >
              {c.label}
              <X size={12} />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              onClick={clearAll}
              className="ml-1 text-xs text-dark-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
