import { useState } from 'react'
import { KeyRound, ExternalLink, Loader2, Check } from 'lucide-react'
import { setTmdbApiKey, getGenreList } from '@/services/tmdb'

interface TmdbKeySetupProps {
  /** Called once a working key has been saved. */
  onSaved: () => void
}

/**
 * First-run state for Movies & TV. Production builds ship without a TMDB key,
 * so this is the first thing most users see — it takes the key inline rather
 * than sending them off to Settings to hunt for the field.
 */
export default function TmdbKeySetup({ onSaved }: TmdbKeySetupProps): JSX.Element {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    const trimmed = key.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)

    // Apply live, then spend one cheap call proving the key works — better than
    // dropping the user onto a home page of silently failed rows.
    setTmdbApiKey(trimmed)
    try {
      const genres = await getGenreList('movie')
      if (!genres.length) throw new Error('no genres returned')
    } catch {
      setTmdbApiKey('')
      setError('TMDB didn’t accept that key. Copy the “API Key” value (v3 auth), not the read access token.')
      setSaving(false)
      return
    }

    try {
      await window.api.setSetting('tmdbApiKey', trimmed)
    } catch {
      setError('Could not save the key to disk.')
      setSaving(false)
      return
    }
    onSaved()
  }

  const stepCls =
    'shrink-0 w-6 h-6 rounded-full bg-dark-800 text-dark-300 text-xs font-semibold ' +
    'flex items-center justify-center'

  return (
    <div className="flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <KeyRound size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Connect TMDB</h1>
            <p className="text-sm text-dark-400">
              One free key unlocks Movies &amp; TV. Takes about a minute.
            </p>
          </div>
        </div>

        <ol className="mt-7 space-y-4">
          <li className="flex gap-3">
            <span className={stepCls}>1</span>
            <div className="text-sm">
              <p className="text-dark-200">Create a free TMDB account, then open your API settings.</p>
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline mt-1"
              >
                themoviedb.org/settings/api <ExternalLink size={11} />
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className={stepCls}>2</span>
            <p className="text-sm text-dark-200">
              Copy the <span className="text-white font-medium">API Key</span> value (v3 auth).
            </p>
          </li>
          <li className="flex gap-3">
            <span className={stepCls}>3</span>
            <p className="text-sm text-dark-200">Paste it here.</p>
          </li>
        </ol>

        <div className="mt-5 flex items-center gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            placeholder="Paste your TMDB v3 API key"
            spellCheck={false}
            autoComplete="off"
            autoFocus
            className="flex-1 min-w-0 px-3 py-2 bg-dark-900 border border-dark-800 rounded-lg font-mono
                       text-sm text-white placeholder:text-dark-500 focus:outline-none
                       focus:border-accent transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={!key.trim() || saving}
            className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Save
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        <p className="text-xs text-dark-500 mt-4">
          Stored only on this device, never bundled into the app. You can change it later in
          Settings.
        </p>
      </div>
    </div>
  )
}
