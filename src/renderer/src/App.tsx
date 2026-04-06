import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import UpdateNotification from './components/UpdateNotification'
import Tutorial from './components/Tutorial'
import HubPage from './pages/HubPage'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import LibraryPage from './pages/LibraryPage'
import AnimePage from './pages/AnimePage'
import WatchPage from './pages/WatchPage'
import MoviesHomePage from './pages/MoviesHomePage'
import MoviesSearchPage from './pages/MoviesSearchPage'
import MoviesLibraryPage from './pages/MoviesLibraryPage'
import MediaDetailPage from './pages/MediaDetailPage'
import MoviesWatchPage from './pages/MoviesWatchPage'
import SettingsPage from './pages/SettingsPage'

function getThemeClass(pathname: string): string {
  if (pathname.startsWith('/movies')) return 'theme-movies'
  if (pathname.startsWith('/anime')) return 'theme-anime'
  return ''
}

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

function applyAccentColor(hex: string): void {
  const { h, s } = hexToHSL(hex)
  document.documentElement.style.setProperty('--color-accent', hex)
  document.documentElement.style.setProperty('--color-accent-hover', `hsl(${h}, ${Math.min(s + 5, 100)}%, 58%)`)
  document.documentElement.style.setProperty('--color-accent-light', `hsl(${h}, ${Math.min(s + 10, 100)}%, 72%)`)
  document.documentElement.style.setProperty('--color-accent-dark', `hsl(${h}, ${s}%, 40%)`)
}

export default function App(): JSX.Element {
  const location = useLocation()
  const isWatchPage =
    location.pathname.startsWith('/anime/watch/') ||
    location.pathname.startsWith('/movies/watch/')
  const isHub = location.pathname === '/'
  const themeClass = getThemeClass(location.pathname)

  // Apply saved accent colors when mode changes
  const currentMode = location.pathname.startsWith('/movies')
    ? 'movies'
    : location.pathname.startsWith('/anime')
      ? 'anime'
      : 'hub'

  useEffect(() => {
    window.api.getAllSettings().then((settings) => {
      if (currentMode === 'movies') {
        applyAccentColor(settings.movieAccentColor || '#e50914')
      } else if (currentMode === 'anime') {
        applyAccentColor(settings.accentColor || '#6c5ce7')
      }
    })
  }, [currentMode])

  return (
    <div className={`flex flex-col h-screen ${themeClass}`}>
      {!isWatchPage && !isHub && <TitleBar />}
      <div className="flex flex-1 overflow-hidden">
        {!isWatchPage && !isHub && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* Hub */}
            <Route path="/" element={<HubPage />} />

            {/* Anime mode */}
            <Route path="/anime" element={<HomePage />} />
            <Route path="/anime/search" element={<SearchPage />} />
            <Route path="/anime/library" element={<LibraryPage />} />
            <Route path="/anime/library/:status" element={<LibraryPage />} />
            <Route path="/anime/detail/:id" element={<AnimePage />} />
            <Route path="/anime/watch/:id/:episode" element={<WatchPage />} />

            {/* Movies & TV mode */}
            <Route path="/movies" element={<MoviesHomePage />} />
            <Route path="/movies/search" element={<MoviesSearchPage />} />
            <Route path="/movies/library" element={<MoviesLibraryPage />} />
            <Route path="/movies/library/:status" element={<MoviesLibraryPage />} />
            <Route path="/movies/detail/:type/:id" element={<MediaDetailPage />} />
            <Route path="/movies/watch/:type/:id" element={<MoviesWatchPage />} />
            <Route path="/movies/watch/:type/:id/:season/:episode" element={<MoviesWatchPage />} />

            {/* Settings (accessible from both modes) */}
            <Route path="/anime/settings" element={<SettingsPage />} />
            <Route path="/movies/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <UpdateNotification />
      {!isWatchPage && !isHub && <Tutorial />}
    </div>
  )
}
