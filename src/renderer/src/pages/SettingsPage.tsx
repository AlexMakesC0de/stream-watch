import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, RotateCcw, Palette, Info } from 'lucide-react'

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

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname.startsWith('/movies') ? 'movies' : 'anime'

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [accentColor, setAccentColor] = useState('#6c5ce7')
  const [movieAccentColor, setMovieAccentColor] = useState('#e50914')

  useEffect(() => {
    window.api.getAllSettings().then((s) => {
      setSettings(s)
      setAccentColor(s.accentColor || '#6c5ce7')
      setMovieAccentColor(s.movieAccentColor || '#e50914')
      setLoading(false)
    })
  }, [])

  // Apply accent colors live as preview
  useEffect(() => {
    if (mode === 'anime') {
      const v = generateAccentVariants(accentColor)
      document.documentElement.style.setProperty('--color-accent', v.base)
      document.documentElement.style.setProperty('--color-accent-hover', v.hover)
      document.documentElement.style.setProperty('--color-accent-light', v.light)
      document.documentElement.style.setProperty('--color-accent-dark', v.dark)
    }
  }, [accentColor, mode])

  useEffect(() => {
    if (mode === 'movies') {
      const v = generateAccentVariants(movieAccentColor)
      document.documentElement.style.setProperty('--color-accent', v.base)
      document.documentElement.style.setProperty('--color-accent-hover', v.hover)
      document.documentElement.style.setProperty('--color-accent-light', v.light)
      document.documentElement.style.setProperty('--color-accent-dark', v.dark)
    }
  }, [movieAccentColor, mode])

  async function handleSave(): Promise<void> {
    await window.api.setSetting('accentColor', accentColor)
    await window.api.setSetting('movieAccentColor', movieAccentColor)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset(): Promise<void> {
    await window.api.resetSettings()
    const fresh = await window.api.getAllSettings()
    setSettings(fresh)
    setAccentColor(fresh.accentColor || '#6c5ce7')
    setMovieAccentColor(fresh.movieAccentColor || '#e50914')
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

      {/* About */}
      <section className="bg-dark-900 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3 text-white">
          <Info size={20} className="text-accent" />
          <h2 className="text-lg font-semibold">About</h2>
        </div>
        <div className="text-sm text-dark-400 space-y-1">
          <p>StreamWatch — Ad-free streaming for Anime, Movies & TV</p>
          <p className="text-dark-500">
            Built with Electron + React
          </p>
        </div>
      </section>
    </div>
  )
}
