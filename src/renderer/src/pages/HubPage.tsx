import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Tv, Film, Sparkles, Minus, Square, Copy, X } from 'lucide-react'

export default function HubPage(): JSX.Element {
  const navigate = useNavigate()
  const [appVersion, setAppVersion] = useState('...')
  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = navigator.userAgent.includes('Macintosh')

  useEffect(() => {
    // Auto-redirect if remember-mode is set
    const remembered = localStorage.getItem('hub-remember-mode')
    if (remembered === 'anime' || remembered === 'movies') {
      navigate(`/${remembered}`, { replace: true })
      return
    }

    window.api.getAppVersion().then(setAppVersion).catch(() => setAppVersion('?'))
    window.api.isMaximized().then(setIsMaximized)
    const cleanup = window.api.onMaximizedChanged(setIsMaximized)
    return cleanup
  }, [])

  function selectMode(mode: 'anime' | 'movies'): void {
    localStorage.setItem('last-mode', mode)
    navigate(`/${mode}`)
  }

  function handleRememberToggle(e: React.ChangeEvent<HTMLInputElement>): void {
    const lastMode = localStorage.getItem('last-mode')
    if (e.target.checked && lastMode) {
      localStorage.setItem('hub-remember-mode', lastMode)
    } else {
      localStorage.removeItem('hub-remember-mode')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-dark-950">
      {/* Draggable title bar with window controls */}
      <div className={`drag-region flex items-center h-9 shrink-0 ${isMac ? 'pl-20' : ''}`}>
        <div className="flex-1" />
        {!isMac && (
          <div className="no-drag flex items-center pr-1">
            <button
              onClick={() => window.api.minimizeWindow()}
              className="hover:bg-dark-800 p-1.5 rounded transition-colors"
              title="Minimize"
            >
              <Minus size={14} className="text-dark-400" />
            </button>
            <button
              onClick={() => window.api.maximizeWindow()}
              className="hover:bg-dark-800 p-1.5 rounded transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Copy size={12} className="text-dark-400" />
              ) : (
                <Square size={12} className="text-dark-400" />
              )}
            </button>
            <button
              onClick={() => window.api.closeWindow()}
              className="hover:bg-red-600 p-1.5 rounded transition-colors group"
              title="Close"
            >
              <X size={14} className="text-dark-400 group-hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        {/* Logo / title */}
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={32} className="text-white" />
          <h1 className="text-4xl font-bold text-white tracking-tight">StreamWatch</h1>
        </div>
        <p className="text-dark-400 text-sm mb-12">Choose your experience</p>

        {/* Mode cards */}
        <div className="flex gap-6 max-w-2xl w-full">
          {/* Anime card */}
          <button
            onClick={() => selectMode('anime')}
            className="flex-1 group relative overflow-hidden rounded-2xl bg-dark-900 border border-dark-800
                       hover:border-[#6c5ce7]/50 transition-all duration-300 p-8 text-left
                       hover:shadow-[0_0_40px_rgba(108,92,231,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#6c5ce7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-[#6c5ce7]/10 flex items-center justify-center mb-5 group-hover:bg-[#6c5ce7]/20 transition-colors">
                <Tv size={28} className="text-[#6c5ce7]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Anime</h2>
              <p className="text-dark-400 text-sm leading-relaxed">
                Browse trending anime, track episodes, and stream with sub or dub.
                Powered by AniList.
              </p>
            </div>
          </button>

          {/* Movies & TV card */}
          <button
            onClick={() => selectMode('movies')}
            className="flex-1 group relative overflow-hidden rounded-2xl bg-dark-900 border border-dark-800
                       hover:border-[#e50914]/50 transition-all duration-300 p-8 text-left
                       hover:shadow-[0_0_40px_rgba(229,9,20,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#e50914]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-[#e50914]/10 flex items-center justify-center mb-5 group-hover:bg-[#e50914]/20 transition-colors">
                <Film size={28} className="text-[#e50914]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Movies & TV</h2>
              <p className="text-dark-400 text-sm leading-relaxed">
                Discover trending movies and TV shows. Stream anything instantly.
                Powered by TMDB.
              </p>
            </div>
          </button>
        </div>

        {/* Remember choice */}
        <label className="flex items-center gap-2 mt-8 text-dark-500 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            onChange={handleRememberToggle}
            defaultChecked={!!localStorage.getItem('hub-remember-mode')}
            className="rounded border-dark-700 bg-dark-900 text-accent"
          />
          Remember my choice
        </label>
      </div>

      {/* Version */}
      <div className="text-center pb-4 text-dark-600 text-xs">
        StreamWatch v{appVersion}
      </div>
    </div>
  )
}
