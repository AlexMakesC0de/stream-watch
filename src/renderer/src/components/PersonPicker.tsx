import { useEffect, useRef, useState } from 'react'
import { User, X, Search, Loader2 } from 'lucide-react'
import { searchPeople, profileUrl } from '@/services/tmdb'
import type { TMDBPerson } from '@/types'

export interface SelectedPerson {
  id: number
  name: string
}

interface PersonPickerProps {
  value: SelectedPerson | null
  onChange: (person: SelectedPerson | null) => void
  disabled?: boolean
}

/** A compact actor/cast picker: searches TMDB people and emits the chosen one. */
export default function PersonPicker({ value, onChange, disabled }: PersonPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBPerson[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside the popover
  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Debounced person search
  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = await searchPeople(query.trim(), 1)
        setResults(data.results.slice(0, 8))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query, open])

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-accent/15 text-accent text-sm rounded-lg px-2.5 py-1.5 border border-accent/30">
        <User size={14} />
        <span className="max-w-[10rem] truncate">{value.name}</span>
        <button onClick={() => onChange(null)} className="hover:text-white" aria-label="Clear actor">
          <X size={14} />
        </button>
      </span>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 bg-dark-800 text-dark-200 text-sm rounded-lg px-3 py-1.5
                   border border-dark-700 hover:bg-dark-700 transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <User size={14} />
        Actor
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-64 bg-dark-900 border border-dark-700 rounded-lg shadow-xl p-2">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actor…"
              className="w-full pl-8 pr-2 py-1.5 bg-dark-800 border border-dark-700 rounded text-sm
                         text-white placeholder:text-dark-500 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-3">
                <Loader2 size={16} className="animate-spin text-accent" />
              </div>
            )}
            {!loading && query.trim() && results.length === 0 && (
              <p className="text-xs text-dark-500 py-3 text-center">No people found</p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange({ id: p.id, name: p.name })
                  setOpen(false)
                  setQuery('')
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-800 text-left"
              >
                {p.profile_path ? (
                  <img
                    src={profileUrl(p.profile_path, 'w185')}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center shrink-0">
                    <User size={14} className="text-dark-500" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-white truncate">{p.name}</span>
                  {p.known_for_department && (
                    <span className="block text-[11px] text-dark-500">{p.known_for_department}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
