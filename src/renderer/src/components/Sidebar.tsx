import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Home,
  Search,
  Library,
  Play,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Bookmark,
  Tv,
  Film,
  ArrowLeftRight,
  LayoutGrid,
  Settings
} from 'lucide-react'

type AppMode = 'anime' | 'movies'

function getModeFromPath(pathname: string): AppMode {
  if (pathname.startsWith('/movies')) return 'movies'
  return 'anime'
}

function getLinks(mode: AppMode) {
  const prefix = `/${mode}`
  const mainLinks = [
    { to: prefix, icon: Home, label: 'Home' },
    { to: `${prefix}/search`, icon: Search, label: 'Discover' },
    { to: `${prefix}/library`, icon: Library, label: 'My Library' }
  ]
  const libraryFilters = [
    { to: `${prefix}/library/WATCHING`, icon: Play, label: 'Watching', color: 'text-blue-400' },
    { to: `${prefix}/library/PLAN_TO_WATCH`, icon: Bookmark, label: 'Plan to Watch', color: 'text-yellow-400' },
    { to: `${prefix}/library/COMPLETED`, icon: CheckCircle2, label: 'Completed', color: 'text-green-400' },
    { to: `${prefix}/library/ON_HOLD`, icon: PauseCircle, label: 'On Hold', color: 'text-orange-400' },
    { to: `${prefix}/library/DROPPED`, icon: XCircle, label: 'Dropped', color: 'text-red-400' }
  ]
  return { mainLinks, libraryFilters }
}

export default function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = getModeFromPath(location.pathname)
  const { mainLinks, libraryFilters } = getLinks(mode)
  const [appVersion, setAppVersion] = useState('...')

  const otherMode: AppMode = mode === 'anime' ? 'movies' : 'anime'
  const searchPlaceholder = mode === 'anime' ? 'Search anime...' : 'Search movies & TV...'

  useEffect(() => {
    let mounted = true
    window.api.getAppVersion()
      .then((version) => {
        if (mounted) setAppVersion(version)
      })
      .catch(() => {
        if (mounted) setAppVersion('?')
      })

    return () => {
      mounted = false
    }
  }, [])

  function switchToMode(target: AppMode): void {
    localStorage.setItem('last-mode', target)
    navigate(`/${target}`)
  }

  return (
    <aside className="w-56 bg-dark-950 border-r border-dark-900 flex flex-col shrink-0">
      {/* Quick search */}
      <div className="p-3">
        <button
          onClick={() => navigate(`/${mode}/search`)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-900 text-dark-400
                     hover:bg-dark-800 hover:text-dark-300 transition-colors text-sm"
        >
          <Search size={15} />
          <span>{searchPlaceholder}</span>
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-2 space-y-0.5">
        {mainLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/${mode}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-dark-300 hover:bg-dark-900 hover:text-white'
              }`
            }
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Library filters */}
      <div className="mt-6 px-2">
        <h3 className="text-xs font-semibold text-dark-500 uppercase tracking-wider px-3 mb-2">
          Library
        </h3>
        <div className="space-y-0.5">
          {libraryFilters.map((filter) => (
            <NavLink
              key={filter.to}
              to={filter.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-dark-900 text-white'
                    : 'text-dark-400 hover:bg-dark-900 hover:text-dark-200'
                }`
              }
            >
              <filter.icon size={16} className={filter.color} />
              {filter.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Spacer + settings + mode switcher + version */}
      <div className="mt-auto p-3 space-y-2">
        {/* Settings */}
        <button
          onClick={() => navigate(`/${mode}/settings`)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                     text-dark-400 hover:bg-dark-900 hover:text-white transition-colors"
        >
          <Settings size={16} />
          Settings
        </button>

        {/* Switch mode */}
        <button
          onClick={() => switchToMode(otherMode)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                     text-dark-400 hover:bg-dark-900 hover:text-white transition-colors"
        >
          {otherMode === 'movies' ? <Film size={16} /> : <Tv size={16} />}
          Switch to {otherMode === 'movies' ? 'Movies & TV' : 'Anime'}
        </button>

        {/* Back to hub */}
        <button
          onClick={() => {
            localStorage.removeItem('hub-remember-mode')
            navigate('/')
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                     text-dark-500 hover:bg-dark-900 hover:text-dark-300 transition-colors"
        >
          <LayoutGrid size={16} />
          Back to Hub
        </button>

        <div className="flex items-center gap-2 text-dark-600 text-xs px-3 pt-1">
          <Clock size={12} />
          <span>v{appVersion}</span>
        </div>
      </div>
    </aside>
  )
}
