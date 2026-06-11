import { useState, useCallback } from 'react'
import { MonitorPlay } from 'lucide-react'
import LazyMediaRow from './LazyMediaRow'
import { discoverByWatchProvider } from '@/services/tmdb'

const REGION = 'US'

// TMDB watch-provider ids (US). Pipe-joined to cover rebrands/variants.
const PROVIDERS = [
  { name: 'Netflix', ids: '8' },
  { name: 'Prime Video', ids: '9|119|2100' },
  { name: 'Max', ids: '1899|384' },
  { name: 'Disney+', ids: '337' },
  { name: 'Apple TV+', ids: '350' },
  { name: 'Paramount+', ids: '531|1770' },
  { name: 'Hulu', ids: '15' }
]

export default function ProviderRow(): JSX.Element {
  const [providerName, setProviderName] = useState(PROVIDERS[0].name)
  const provider = PROVIDERS.find((p) => p.name === providerName) ?? PROVIDERS[0]

  // Re-created when the selected provider changes → LazyMediaRow resets/reloads.
  const fetchPage = useCallback(
    (page: number) => discoverByWatchProvider(provider.ids, REGION, page),
    [provider.ids]
  )

  const dropdown = (
    <select
      value={providerName}
      onChange={(e) => setProviderName(e.target.value)}
      className="bg-dark-800 border border-dark-700 rounded-lg px-2.5 py-1.5 text-sm text-white
                 focus:outline-none focus:border-accent cursor-pointer"
    >
      {PROVIDERS.map((p) => (
        <option key={p.name} value={p.name}>
          {p.name}
        </option>
      ))}
    </select>
  )

  return (
    <LazyMediaRow title="Only on" Icon={MonitorPlay} fetchPage={fetchPage} headerRight={dropdown} />
  )
}
