import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Search, Settings, Minus, Square, Copy, X } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  /** Marks active when the current path starts with any of these. */
  match?: string[]
  /** …unless it starts with one of these (sibling routes under a shared prefix). */
  exclude?: string[]
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/movies', label: 'Movies', match: ['/movies'], exclude: ['/movies/library', '/movies/settings', '/movies/search'] },
  { to: '/series', label: 'Series', match: ['/series'] },
  { to: '/anime', label: 'Anime', match: ['/anime'], exclude: ['/anime/library', '/anime/settings'] },
  { to: '/movies/library', label: 'My List', match: ['/movies/library', '/anime/library'] }
]

/**
 * One navigation for the whole app, replacing the mode hub and the per-mode
 * sidebar. Transparent while the hero is under it, solid once the page moves —
 * the arrangement Disney+, Max and Apple TV+ all share.
 */
export default function TopNav({ scrolled }: { scrolled: boolean }): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const isMac = navigator.userAgent.includes('Macintosh')
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.isMaximized().then(setIsMaximized)
    return window.api.onMaximizedChanged(setIsMaximized)
  }, [])

  function isActive(item: NavItem): boolean {
    if (item.end) return location.pathname === item.to
    if (item.exclude?.some((p) => location.pathname.startsWith(p))) return false
    return (item.match ?? [item.to]).some((p) => location.pathname.startsWith(p))
  }

  return (
    <header
      className={`drag-region fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-dark-950/95 backdrop-blur-md border-b border-dark-700' : 'bg-transparent'
      }`}
    >
      {/* A scrim under the bar so nav stays legible over bright key art before
          the page has scrolled and the solid background takes over. */}
      {!scrolled && (
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
      )}

      <div
        className={`relative flex items-center h-14 pr-3 ${isMac ? 'pl-[92px]' : 'pl-5'}`}
      >
        {/* Brand and nav share one baseline: same height, same vertical
            centring, so the wordmark no longer floats against the links. */}
        <button
          onClick={() => navigate('/')}
          className="no-drag flex items-center h-9 px-1 mr-6 text-[15px] font-bold tracking-tight text-white shrink-0"
        >
          StreamWatch
        </button>

        <div className="flex-1" />

        {/* Centred on the window, not floated after the wordmark, so the nav
            stays put as the brand or the right-hand controls change width. */}
        <nav className="no-drag absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {NAV.map((item) => {
            const active = isActive(item)
            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={`group/nav relative flex items-center h-9 px-3.5 text-sm transition-colors duration-200 ${
                  active ? 'text-white font-semibold' : 'text-dark-300 hover:text-white'
                }`}
              >
                <span className="transition-transform duration-200 ease-out group-hover/nav:-translate-y-px">
                  {item.label}
                </span>
                {/* Underline wipes out from the centre on hover and stays put
                    once the route is active. */}
                <span
                  className={`absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-accent origin-center
                              transition-transform duration-250 ease-out ${
                                active ? 'scale-x-100' : 'scale-x-0 group-hover/nav:scale-x-100'
                              }`}
                />
              </NavLink>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="no-drag flex items-center gap-1">
          <button
            onClick={() => navigate('/search')}
            title="Search"
            aria-label="Search"
            className="p-2 rounded-md text-dark-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => navigate('/movies/settings')}
            title="Settings"
            aria-label="Settings"
            className="p-2 rounded-md text-dark-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Settings size={18} />
          </button>

          {!isMac && (
            <>
              <div className="w-px h-5 bg-dark-600 mx-1.5" />
              <button
                onClick={() => window.api.minimizeWindow()}
                title="Minimize"
                aria-label="Minimize"
                className="p-2 rounded-md text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => window.api.maximizeWindow()}
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                className="p-2 rounded-md text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isMaximized ? <Copy size={12} /> : <Square size={12} />}
              </button>
              <button
                onClick={() => window.api.closeWindow()}
                title="Close"
                aria-label="Close"
                className="p-2 rounded-md text-dark-400 hover:text-white hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
