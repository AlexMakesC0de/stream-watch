import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, X, SlidersHorizontal } from 'lucide-react'
import PersonPicker, { type SelectedPerson } from './PersonPicker'
import { getGenreList } from '@/services/tmdb'
import { getAnimeGenres } from '@/services/anilist'
import type { TMDBGenre } from '@/types'

export type BrowseKind = 'movie' | 'tv' | 'anime'

export interface BrowseFilterState {
  /** TMDB genre ids for film/series; AniList genre names for anime. */
  genreIds: number[]
  genreNames: string[]
  year: number | null
  minRating: number
  sortBy: 'popular' | 'rating' | 'newest' | 'oldest'
  cast: SelectedPerson | null
}

export const EMPTY_FILTERS: BrowseFilterState = {
  genreIds: [],
  genreNames: [],
  year: null,
  minRating: 0,
  sortBy: 'popular',
  cast: null
}

const SORTS: { value: BrowseFilterState['sortBy']; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' }
]

const RATINGS = [0, 5, 6, 7, 8]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i)

const control =
  'appearance-none bg-dark-800 text-dark-100 text-sm rounded-lg pl-3 pr-8 py-2 border ' +
  'border-dark-700 hover:border-dark-600 focus:outline-none focus:border-accent cursor-pointer transition-colors'

export function countActive(f: BrowseFilterState): number {
  return (
    f.genreIds.length +
    f.genreNames.length +
    (f.year ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.sortBy !== 'popular' ? 1 : 0) +
    (f.cast ? 1 : 0)
  )
}

interface BrowseFiltersProps {
  kind: BrowseKind
  value: BrowseFilterState
  onChange: (patch: Partial<BrowseFilterState>) => void
  onReset: () => void
}

/**
 * Genre, year, rating, sort and cast for the browse list. Restyled to match
 * the rest of the app and shown on the page itself — filters that live behind
 * a separate route are filters nobody finds.
 */
export default function BrowseFilters({
  kind,
  value,
  onChange,
  onReset
}: BrowseFiltersProps): JSX.Element {
  const isAnime = kind === 'anime'
  const [tmdbGenres, setTmdbGenres] = useState<TMDBGenre[]>([])
  const [animeGenres, setAnimeGenres] = useState<string[]>([])
  const [genreOpen, setGenreOpen] = useState(false)
  const genreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isAnime) {
      getAnimeGenres().then(setAnimeGenres).catch(() => setAnimeGenres([]))
    } else {
      getGenreList(kind).then(setTmdbGenres).catch(() => setTmdbGenres([]))
    }
  }, [kind, isAnime])

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) setGenreOpen(false)
    }
    if (genreOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [genreOpen])

  const selectedGenreCount = isAnime ? value.genreNames.length : value.genreIds.length

  function toggleGenre(key: number | string): void {
    if (isAnime) {
      const name = key as string
      const next = value.genreNames.includes(name)
        ? value.genreNames.filter((g) => g !== name)
        : [...value.genreNames, name]
      onChange({ genreNames: next })
    } else {
      const id = key as number
      const next = value.genreIds.includes(id)
        ? value.genreIds.filter((g) => g !== id)
        : [...value.genreIds, id]
      onChange({ genreIds: next })
    }
  }

  // Removable chips for whatever is currently narrowing the list.
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (isAnime) {
    value.genreNames.forEach((g) =>
      chips.push({ key: `g-${g}`, label: g, clear: () => toggleGenre(g) })
    )
  } else {
    value.genreIds.forEach((id) =>
      chips.push({
        key: `g-${id}`,
        label: tmdbGenres.find((g) => g.id === id)?.name ?? 'Genre',
        clear: () => toggleGenre(id)
      })
    )
  }
  if (value.year) chips.push({ key: 'y', label: String(value.year), clear: () => onChange({ year: null }) })
  if (value.minRating)
    chips.push({ key: 'r', label: `${value.minRating}+ ★`, clear: () => onChange({ minRating: 0 }) })
  if (value.sortBy !== 'popular')
    chips.push({
      key: 's',
      label: SORTS.find((s) => s.value === value.sortBy)!.label,
      clear: () => onChange({ sortBy: 'popular' })
    })
  if (value.cast)
    chips.push({ key: 'c', label: value.cast.name, clear: () => onChange({ cast: null }) })

  const Chevron = (
    <ChevronDown
      size={14}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none"
    />
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-dark-300 mr-1">
          <SlidersHorizontal size={15} className="text-accent-light" />
          Filter
        </span>

        {/* Genre */}
        <div ref={genreRef} className="relative">
          <button
            onClick={() => setGenreOpen((o) => !o)}
            className={`flex items-center gap-2 bg-dark-800 text-sm rounded-lg pl-3 pr-2.5 py-2 border transition-colors ${
              selectedGenreCount
                ? 'border-accent text-white'
                : 'border-dark-700 text-dark-100 hover:border-dark-600'
            }`}
          >
            {selectedGenreCount ? `Genres · ${selectedGenreCount}` : 'Genre'}
            <ChevronDown size={14} className="text-dark-400" />
          </button>
          {genreOpen && (
            <div className="absolute z-30 mt-1.5 w-60 max-h-80 overflow-y-auto bg-dark-900 border border-dark-700 rounded-lg shadow-xl p-1.5">
              {(isAnime
                ? animeGenres.map((g) => ({ key: g as string | number, name: g }))
                : tmdbGenres.map((g) => ({ key: g.id as string | number, name: g.name }))
              ).map((g) => {
                const on = isAnime
                  ? value.genreNames.includes(g.name)
                  : value.genreIds.includes(g.key as number)
                return (
                  <button
                    key={String(g.key)}
                    onClick={() => toggleGenre(g.key)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm text-left hover:bg-dark-800 transition-colors"
                  >
                    <span className={on ? 'text-accent-light' : 'text-dark-200'}>{g.name}</span>
                    {on && <Check size={14} className="text-accent-light" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Year */}
        <div className="relative">
          <select
            value={value.year ?? ''}
            onChange={(e) => onChange({ year: e.target.value ? parseInt(e.target.value) : null })}
            className={control}
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

        {/* Minimum rating */}
        <div className="relative">
          <select
            value={value.minRating}
            onChange={(e) => onChange({ minRating: parseInt(e.target.value) })}
            className={control}
          >
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'Any rating' : `${r}+ ★`}
              </option>
            ))}
          </select>
          {Chevron}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={value.sortBy}
            onChange={(e) =>
              onChange({ sortBy: e.target.value as BrowseFilterState['sortBy'] })
            }
            className={control}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {Chevron}
        </div>

        {/* Cast — TMDB people only; AniList has no equivalent person index. */}
        {!isAnime && (
          <PersonPicker value={value.cast} onChange={(p) => onChange({ cast: p })} disabled={false} />
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              title={`Remove ${c.label}`}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium
                         bg-accent/15 text-accent-light hover:bg-accent/25 transition-colors"
            >
              {c.label}
              <X size={12} />
            </button>
          ))}
          <button
            onClick={onReset}
            className="ml-1 text-xs text-dark-400 hover:text-white transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
