import { useSearchParams } from 'react-router-dom'
import SearchSurface, { type SearchScope } from '@/components/SearchSurface'

function readScope(value: string | null): SearchScope {
  return value === 'tv' || value === 'anime' ? value : 'movie'
}

/**
 * The standalone search route. It renders the same SearchSurface the browse
 * pages use — the point being there is exactly one search UI in the app. This
 * file used to be a fourth, anime-only implementation of the same idea.
 */
export default function SearchPage(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const scope = readScope(params.get('type'))

  function patch(next: { q?: string; type?: SearchScope }): void {
    const q = next.q ?? query
    const type = next.type ?? scope
    const out: Record<string, string> = { type }
    if (q) out.q = q
    setParams(out, { replace: true })
  }

  return (
    <div className="px-8 py-7 pb-20">
      <h1 className="text-2xl font-bold text-white mb-6">Search</h1>
      <SearchSurface
        scope={scope}
        query={query}
        onQueryChange={(q) => patch({ q })}
        onScopeChange={(type) => patch({ type })}
        autoFocus
      />
    </div>
  )
}
