import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Palette,
  Info,
  KeyRound,
  Server,
  Plus,
  Trash2,
  Download,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Database
} from 'lucide-react'
import { setTmdbApiKey } from '@/services/tmdb'

const COLOR_PRESETS = [
  { name: 'Purple', value: '#6c5ce7' },
  { name: 'Blue', value: '#0984e3' },
  { name: 'Teal', value: '#00b894' },
  { name: 'Green', value: '#00cec9' },
  { name: 'Yellow', value: '#fdcb6e' },
  { name: 'Orange', value: '#e17055' },
  { name: 'Pink', value: '#e84393' },
  { name: 'Cyan', value: '#74b9ff' }
]

const MOVIE_COLOR_PRESETS = [
  { name: 'Red', value: '#e50914' },
  { name: 'Orange', value: '#e17055' },
  { name: 'Gold', value: '#f39c12' },
  { name: 'Purple', value: '#6c5ce7' },
  { name: 'Blue', value: '#0984e3' },
  { name: 'Teal', value: '#00b894' },
  { name: 'Pink', value: '#e84393' },
  { name: 'Crimson', value: '#c0392b' }
]

interface CustomProvider {
  name: string
  movie: string
  tv: string
}

const INPUT_CLASS =
  'w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white ' +
  'placeholder-dark-500 focus:outline-none focus:border-accent transition-colors'

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function generateAccentVariants(hex: string): {
  base: string
  hover: string
  light: string
  dark: string
} {
  const { h, s } = hexToHSL(hex)
  return {
    base: hex,
    hover: `hsl(${h}, ${Math.min(s + 5, 100)}%, 58%)`,
    light: `hsl(${h}, ${Math.min(s + 10, 100)}%, 72%)`,
    dark: `hsl(${h}, ${s}%, 40%)`
  }
}

function mirrorsToText(csv: string): string {
  return csv
    .split(/[\n,]+/)
    .map((m) => m.trim())
    .filter(Boolean)
    .join('\n')
}

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname.startsWith('/movies') ? 'movies' : 'anime'

  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [accentColor, setAccentColor] = useState('#6c5ce7')
  const [movieAccentColor, setMovieAccentColor] = useState('#e50914')

  // Data sources
  const [tmdbKey, setTmdbKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([])
  const [popcornMirrors, setPopcornMirrors] = useState('')

  // Backup
  const [includeSettingsOnImport, setIncludeSettingsOnImport] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [backupMsg, setBackupMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function loadFromSettings(s: Record<string, string>): void {
    setAccentColor(s.accentColor || '#6c5ce7')
    setMovieAccentColor(s.movieAccentColor || '#e50914')
    setTmdbKey(s.tmdbApiKey || '')
    setPopcornMirrors(mirrorsToText(s.popcornMirrors || ''))
    try {
      const parsed = JSON.parse(s.customEmbedProviders || '[]')
      setCustomProviders(Array.isArray(parsed) ? parsed : [])
    } catch {
      setCustomProviders([])
    }
  }

  useEffect(() => {
    window.api.getAllSettings().then((s) => {
      loadFromSettings(s)
      setLoading(false)
    })
  }, [])

  // Apply accent colors live as preview
  useEffect(() => {
    if (mode !== 'anime') return
    const v = generateAccentVariants(accentColor)
    document.documentElement.style.setProperty('--color-accent', v.base)
    document.documentElement.style.setProperty('--color-accent-hover', v.hover)
    document.documentElement.style.setProperty('--color-accent-light', v.light)
    document.documentElement.style.setProperty('--color-accent-dark', v.dark)
  }, [accentColor, mode])

  useEffect(() => {
    if (mode !== 'movies') return
    const v = generateAccentVariants(movieAccentColor)
    document.documentElement.style.setProperty('--color-accent', v.base)
    document.documentElement.style.setProperty('--color-accent-hover', v.hover)
    document.documentElement.style.setProperty('--color-accent-light', v.light)
    document.documentElement.style.setProperty('--color-accent-dark', v.dark)
  }, [movieAccentColor, mode])

  async function handleSave(): Promise<void> {
    const cleanedProviders = customProviders
      .map((p) => ({ name: p.name.trim(), movie: p.movie.trim(), tv: p.tv.trim() }))
      .filter((p) => p.name && p.movie && p.tv)
    const mirrorsCsv = popcornMirrors
      .split(/[\n,]+/)
      .map((m) => m.trim())
      .filter(Boolean)
      .join(',')

    await window.api.setSetting('accentColor', accentColor)
    await window.api.setSetting('movieAccentColor', movieAccentColor)
    await window.api.setSetting('tmdbApiKey', tmdbKey.trim())
    await window.api.setSetting('customEmbedProviders', JSON.stringify(cleanedProviders))
    await window.api.setSetting('popcornMirrors', mirrorsCsv)

    setTmdbApiKey(tmdbKey.trim()) // apply the key live, no restart needed
    setCustomProviders(cleanedProviders)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset(): Promise<void> {
    await window.api.resetSettings()
    const fresh = await window.api.getAllSettings()
    loadFromSettings(fresh)
    setTmdbApiKey(fresh.tmdbApiKey || '')
  }

  function updateProvider(index: number, field: keyof CustomProvider, value: string): void {
    setCustomProviders((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  function addProvider(): void {
    setCustomProviders((prev) => [...prev, { name: '', movie: '', tv: '' }])
  }

  function removeProvider(index: number): void {
    setCustomProviders((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleExport(): Promise<void> {
    setBusy('export')
    setBackupMsg(null)
    try {
      const res = await window.api.exportLibrary()
      if (res.canceled) return
      if (res.success) {
        setBackupMsg({
          type: 'ok',
          text: `Exported ${res.counts?.anime ?? 0} anime and ${res.counts?.media ?? 0} movies/TV shows.`
        })
      } else {
        setBackupMsg({ type: 'err', text: res.error || 'Export failed.' })
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleImport(): Promise<void> {
    setBusy('import')
    setBackupMsg(null)
    try {
      const res = await window.api.importLibrary(includeSettingsOnImport)
      if (res.canceled) return
      if (res.success) {
        setBackupMsg({
          type: 'ok',
          text: `Imported ${res.counts?.anime ?? 0} anime and ${res.counts?.media ?? 0} movies/TV shows.`
        })
        if (includeSettingsOnImport) {
          const fresh = await window.api.getAllSettings()
          loadFromSettings(fresh)
          setTmdbApiKey(fresh.tmdbApiKey || '')
        }
      } else {
        setBackupMsg({ type: 'err', text: res.error || 'Import failed.' })
      }
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       text-dark-400 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <Save size={16} />
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Appearance */}
      <section className="bg-dark-900 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 text-white">
          <Palette size={20} className="text-accent" />
          <h2 className="text-lg font-semibold">Appearance</h2>
        </div>

        {/* Anime accent color */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-dark-300">Anime Accent Color</label>
          <div className="flex items-center gap-3 flex-wrap">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setAccentColor(preset.value)}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  accentColor === preset.value
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border border-dark-700"
              />
              <span className="text-xs text-dark-500 font-mono">{accentColor}</span>
            </div>
          </div>
        </div>

        {/* Movie accent color */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-dark-300">Movies & TV Accent Color</label>
          <div className="flex items-center gap-3 flex-wrap">
            {MOVIE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setMovieAccentColor(preset.value)}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  movieAccentColor === preset.value
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={movieAccentColor}
                onChange={(e) => setMovieAccentColor(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border border-dark-700"
              />
              <span className="text-xs text-dark-500 font-mono">{movieAccentColor}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="bg-dark-900 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 text-white">
          <Server size={20} className="text-accent" />
          <h2 className="text-lg font-semibold">Data Sources & APIs</h2>
        </div>

        {/* TMDB API key */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-dark-300">
            <KeyRound size={14} />
            TMDB API Key
          </label>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              placeholder="Paste your TMDB v3 API key"
              spellCheck={false}
              autoComplete="off"
              className={`${INPUT_CLASS} font-mono`}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors shrink-0"
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-xs text-dark-500">
            Required for Movies & TV. Stored only on this device — never bundled into the app.{' '}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Get a free key <ExternalLink size={11} />
            </a>
          </p>
        </div>

        {/* Custom streaming sources */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-dark-300">
              Custom Streaming Sources (Movies & TV)
            </label>
            <button
              onClick={addProvider}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              <Plus size={14} />
              Add source
            </button>
          </div>

          {customProviders.length === 0 && (
            <p className="text-xs text-dark-500">
              Using the built-in sources. Add your own embed providers below — they appear first in
              the player&apos;s source list.
            </p>
          )}

          {customProviders.map((provider, i) => (
            <div key={i} className="bg-dark-800/60 border border-dark-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={provider.name}
                  onChange={(e) => updateProvider(i, 'name', e.target.value)}
                  placeholder="Source name (e.g. My VidSrc)"
                  className={INPUT_CLASS}
                />
                <button
                  onClick={() => removeProvider(i)}
                  className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-700 transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                value={provider.movie}
                onChange={(e) => updateProvider(i, 'movie', e.target.value)}
                placeholder="Movie URL — e.g. https://example.com/embed/movie/{id}"
                className={`${INPUT_CLASS} font-mono text-xs`}
              />
              <input
                value={provider.tv}
                onChange={(e) => updateProvider(i, 'tv', e.target.value)}
                placeholder="TV URL — e.g. https://example.com/embed/tv/{id}/{season}/{episode}"
                className={`${INPUT_CLASS} font-mono text-xs`}
              />
            </div>
          ))}

          <p className="text-xs text-dark-500">
            Placeholders: <code className="text-dark-300">{'{id}'}</code> (TMDB id),{' '}
            <code className="text-dark-300">{'{season}'}</code>,{' '}
            <code className="text-dark-300">{'{episode}'}</code>.
          </p>
        </div>

        {/* Popcorn mirrors */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">Torrent API Mirrors</label>
          <textarea
            value={popcornMirrors}
            onChange={(e) => setPopcornMirrors(e.target.value)}
            placeholder={'https://fusme.link\nhttps://jfper.link'}
            rows={3}
            spellCheck={false}
            className={`${INPUT_CLASS} font-mono text-xs resize-y`}
          />
          <p className="text-xs text-dark-500">
            One mirror per line. Used to fetch torrent sources; tried in order with failover.
          </p>
        </div>
      </section>

      {/* Library & Backup */}
      <section className="bg-dark-900 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-white">
          <Database size={20} className="text-accent" />
          <h2 className="text-lg font-semibold">Library & Backup</h2>
        </div>
        <p className="text-sm text-dark-400">
          Export your full library (anime, movies, TV &amp; watch progress) to a JSON file, or
          restore it on another machine. Importing merges into your current library — nothing is
          deleted.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-dark-800 hover:bg-dark-700 text-white transition-colors disabled:opacity-50"
          >
            {busy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export Library
          </button>
          <button
            onClick={handleImport}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-dark-800 hover:bg-dark-700 text-white transition-colors disabled:opacity-50"
          >
            {busy === 'import' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import Library
          </button>
          <label className="flex items-center gap-2 text-xs text-dark-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSettingsOnImport}
              onChange={(e) => setIncludeSettingsOnImport(e.target.checked)}
              className="accent-accent"
            />
            Also import settings (API key, sources, colors)
          </label>
        </div>

        {backupMsg && (
          <p className={`text-sm ${backupMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {backupMsg.text}
          </p>
        )}
      </section>

      {/* About */}
      <section className="bg-dark-900 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3 text-white">
          <Info size={20} className="text-accent" />
          <h2 className="text-lg font-semibold">About</h2>
        </div>
        <div className="text-sm text-dark-400 space-y-1">
          <p>StreamWatch — Ad-free streaming for Anime, Movies & TV</p>
          <p className="text-dark-500">Built with Electron + React</p>
        </div>
      </section>
    </div>
  )
}
