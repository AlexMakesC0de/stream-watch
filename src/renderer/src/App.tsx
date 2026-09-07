import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import TopNav from './components/TopNav'
import ToastProvider from './components/Toast'
import BackToTop from './components/BackToTop'
import ErrorBoundary from './components/ErrorBoundary'
const CommandPalette = lazy(() => import('./components/CommandPalette'))
import { parseKeybinds, matchesCombo, isTypingTarget, type KeybindMap } from './lib/keybinds'
import UpdateNotification from './components/UpdateNotification'
import Tutorial from './components/Tutorial'
import HomeUnifiedPage from './pages/HomeUnifiedPage'
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const AnimePage = lazy(() => import('./pages/AnimePage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const MoviesHomePage = lazy(() => import('./pages/MoviesHomePage'))
const MoviesSearchPage = lazy(() => import('./pages/MoviesSearchPage'))
const MoviesLibraryPage = lazy(() => import('./pages/MoviesLibraryPage'))
const MediaDetailPage = lazy(() => import('./pages/MediaDetailPage'))
const MoviesWatchPage = lazy(() => import('./pages/MoviesWatchPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

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
  const navigate = useNavigate()
  const navType = useNavigationType()
  const mainRef = useRef<HTMLElement>(null)
  const scrollPositions = useRef<Map<string, number>>(new Map())
  const isWatchPage =
    location.pathname.startsWith('/anime/watch/') ||
    location.pathname.startsWith('/movies/watch/')
  // The home hero runs under a transparent nav; every other route starts solid.
  const isHome = location.pathname === '/'
  const [scrolled, setScrolled] = useState(!isHome)
  const [showTop, setShowTop] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [keybinds, setKeybinds] = useState<KeybindMap | null>(null)

  // One accent for the whole app now that the shell is unified — the per-mode
  // violet and red went with the mode split. Anyone upgrading still has the
  // old defaults saved, so treat those two values as "never chosen" rather
  // than letting a stale setting override the new brand.
  useEffect(() => {
    const SUPERSEDED = ['#6c5ce7', '#e50914']
    const read = (): void => {
      window.api.getAllSettings().then((settings) => {
        const saved = (settings.accentColor || '').toLowerCase()
        applyAccentColor(saved && !SUPERSEDED.includes(saved) ? saved : '#0063e5')
        setKeybinds(parseKeybinds(settings.keybinds))
      })
    }
    read()
    // Settings writes rebinds; pick them up without a restart.
    window.addEventListener('streamwatch:settings-changed', read)
    return () => window.removeEventListener('streamwatch:settings-changed', read)
  }, [])

  // ─── Global shortcuts ─────────────────────────────────────────
  useEffect(() => {
    if (!keybinds) return
    function onKey(e: KeyboardEvent): void {
      // Let the palette own the keyboard while it is open.
      if (paletteOpen && !matchesCombo(keybinds!.palette, e)) return
      if (isTypingTarget(e.target) && !(e.metaKey || e.ctrlKey)) return

      if (matchesCombo(keybinds!.palette, e)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (matchesCombo(keybinds!.reload, e)) {
        e.preventDefault()
        window.location.reload()
      } else if (matchesCombo(keybinds!.settings, e)) {
        e.preventDefault()
        navigate('/movies/settings')
      } else if (matchesCombo(keybinds!.list, e)) {
        e.preventDefault()
        navigate('/movies/library')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keybinds, paletteOpen, navigate])

  // ─── Scroll restoration ───────────────────────────────────────
  // Continuously record the current page's scroll so we can restore it on Back.
  // The same listener drives the nav's transparent → solid handoff.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const key = location.key
    const onScroll = (): void => {
      scrollPositions.current.set(key, el.scrollTop)
      setScrolled(!isHome || el.scrollTop > 24)
      setShowTop(el.scrollTop > el.clientHeight * 0.8)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    setScrolled(!isHome || el.scrollTop > 24)
    setShowTop(el.scrollTop > el.clientHeight * 0.8)
    return () => el.removeEventListener('scroll', onScroll)
  }, [location.key, isHome])

  // On Back (POP) restore the saved position; on a new push, start at the top.
  // Rows load and grow the page for seconds after mount, so a fixed number of
  // animation frames used to give up long before the page was tall enough and
  // dropped you at the top. Watch the content box instead and keep re-applying
  // until either the target is reached or the page stops growing.
  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const target = navType === 'POP' ? scrollPositions.current.get(location.key) ?? 0 : 0

    const prevBehavior = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    el.scrollTop = target
    if (target <= 0) {
      el.style.scrollBehavior = prevBehavior
      return
    }

    let settled = false
    const done = (): void => {
      settled = true
      observer.disconnect()
      clearTimeout(giveUp)
      el.style.scrollBehavior = prevBehavior
    }

    const observer = new ResizeObserver(() => {
      if (settled) return
      // Only push downward: never fight the user if they have started scrolling.
      if (el.scrollTop < target - 2) el.scrollTop = target
      if (el.scrollTop >= target - 2) done()
    })
    observer.observe(el.firstElementChild ?? el)

    // Hard stop so a page that never reaches the old height cannot pin scroll.
    const giveUp = setTimeout(done, 4000)
    return done
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  return (
    <ToastProvider>
    <div className="flex flex-col h-screen bg-dark-950">
      {!isWatchPage && <TopNav scrolled={scrolled} />}
      <div className="flex flex-1 overflow-hidden">
        {/* The hero runs edge to edge beneath the floating nav; every other
            route clears it with padding instead. */}
        <main
          ref={mainRef}
          className={`flex-1 overflow-y-auto scroll-smooth ${!isWatchPage && !isHome ? 'pt-14' : ''}`}
        >
          <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<div className="h-full" />}>
          <Routes>
            {/* Unified home */}
            <Route path="/" element={<HomeUnifiedPage />} />

            {/* Anime */}
            <Route path="/anime" element={<BrowsePage key="anime" type="anime" />} />

            <Route path="/anime/library" element={<LibraryPage />} />
            <Route path="/anime/library/:status" element={<LibraryPage />} />
            <Route path="/anime/detail/:id" element={<AnimePage />} />
            <Route path="/anime/watch/:id/:episode" element={<WatchPage />} />

            {/* Movies & TV mode */}
            <Route path="/movies" element={<BrowsePage key="movie" type="movie" />} />
            <Route path="/series" element={<BrowsePage key="tv" type="tv" />} />
            <Route path="/search" element={<SearchPage />} />
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
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {!isWatchPage && (
        <BackToTop
          visible={showTop}
          onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      )}
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
      <UpdateNotification />
      {!isWatchPage && <Tutorial />}
    </div>
    </ToastProvider>
  )
}
