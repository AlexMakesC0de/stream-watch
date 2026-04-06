import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  ChevronDown,
  Loader2,
  Minus,
  Square,
  X,
  RefreshCw
} from 'lucide-react'
import EmbedPlayer from '@/components/EmbedPlayer'
import {
  getMovieDetails,
  getTvShowDetails,
  getTvSeasonDetails
} from '@/services/tmdb'
import type { TMDBMovie, TMDBTvShow, TMDBSeason, MediaEpisodeProgress, MediaType } from '@/types'

/* -- Embed Provider Definitions ------------------------------------------ */

interface EmbedProvider {
  name: string
  buildMovieUrl: (tmdbId: number) => string
  buildTvUrl: (tmdbId: number, season: number, episode: number) => string
}

const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    name: 'VidSrc ICU',
    buildMovieUrl: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    buildTvUrl: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'VidSrc CC',
    buildMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    buildTvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'Embed.su',
    buildMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    buildTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'AutoEmbed',
    buildMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    buildTvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
  }
]

/* -- Helper: add autoplay params to embed URL ---------------------------- */

function withAutoplay(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.searchParams.set('autoplay', '1')
    return url.toString()
  } catch {
    return rawUrl
  }
}

/* -- Component ----------------------------------------------------------- */

export default function MoviesWatchPage(): JSX.Element {
  const { type, id, season, episode } = useParams<{
    type: string
    id: string
    season: string
    episode: string
  }>()
  const navigate = useNavigate()
  const mediaType = (type as MediaType) || 'movie'
  const tmdbId = parseInt(id || '0')
  const currentSeason = parseInt(season || '1')
  const currentEpisode = parseInt(episode || '1')
  const isMac = navigator.userAgent.includes('Macintosh')

  /* -- State ------------------------------------------------------------- */
  const [movie, setMovie] = useState<TMDBMovie | null>(null)
  const [tvShow, setTvShow] = useState<TMDBTvShow | null>(null)
  const [seasonDetail, setSeasonDetail] = useState<TMDBSeason | null>(null)
  const [episodeProgress, setEpisodeProgress] = useState<MediaEpisodeProgress[]>([])
  const [loading, setLoading] = useState(true)

  // Provider cycling
  const [providerIndex, setProviderIndex] = useState(0)
  const [embedUrl, setEmbedUrl] = useState('')

  // Episode sidebar
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState(currentSeason)

  // Auto-hide top bar
  const [controlsVisible, setControlsVisible] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
      setShowEpisodes(false)
    }, 2000)
  }, [])

  const handleTriggerEnter = useCallback(() => {
    setControlsVisible(true)
    startHideTimer()
  }, [startHideTimer])

  const handleBarActivity = useCallback(() => {
    setControlsVisible(true)
    startHideTimer()
  }, [startHideTimer])

  /* -- Fullscreen tracking ----------------------------------------------- */
  useEffect(() => {
    const handleFs = (): void => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFs)
    return () => document.removeEventListener('fullscreenchange', handleFs)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  /* -- Load TMDB data ---------------------------------------------------- */
  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      try {
        if (mediaType === 'movie') {
          const details = await getMovieDetails(tmdbId)
          if (!cancelled) setMovie(details)
        } else {
          const [details, seasonData] = await Promise.all([
            getTvShowDetails(tmdbId),
            getTvSeasonDetails(tmdbId, currentSeason)
          ])
          if (!cancelled) {
            setTvShow(details)
            setSeasonDetail(seasonData)
          }
        }
        // Load saved progress
        const prog = (await window.api.getMediaProgress(
          tmdbId,
          mediaType
        )) as MediaEpisodeProgress[]
        if (!cancelled) setEpisodeProgress(prog)
      } catch (error) {
        console.error('Failed to load media data:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [tmdbId, mediaType, currentSeason])

  /* -- Build embed URL when provider / route changes --------------------- */
  useEffect(() => {
    const provider = EMBED_PROVIDERS[providerIndex]
    const url =
      mediaType === 'movie'
        ? provider.buildMovieUrl(tmdbId)
        : provider.buildTvUrl(tmdbId, currentSeason, currentEpisode)
    setEmbedUrl(withAutoplay(url))
  }, [providerIndex, tmdbId, mediaType, currentSeason, currentEpisode])

  /* -- Load season sidebar episodes -------------------------------------- */
  useEffect(() => {
    if (mediaType !== 'tv') return
    if (selectedSeason === currentSeason && seasonDetail) return
    let cancelled = false
    getTvSeasonDetails(tmdbId, selectedSeason).then((data) => {
      if (!cancelled) setSeasonDetail(data)
    })
    return () => {
      cancelled = true
    }
  }, [selectedSeason])

  /* -- Provider cycling -------------------------------------------------- */
  function cycleProvider(): void {
    setProviderIndex((prev) => (prev + 1) % EMBED_PROVIDERS.length)
  }

  /* -- Progress callbacks ------------------------------------------------ */
  const lastSaveRef = useRef(0)

  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      const now = Date.now()
      if (now - lastSaveRef.current < 5000) return
      lastSaveRef.current = now

      const s = mediaType === 'movie' ? 0 : currentSeason
      const e = mediaType === 'movie' ? 0 : currentEpisode

      window.api.saveMediaProgress({
        tmdbId,
        mediaType,
        seasonNumber: s,
        episodeNumber: e,
        watchedSeconds: currentTime,
        totalSeconds: duration,
        completed: 0
      })
    },
    [tmdbId, mediaType, currentSeason, currentEpisode]
  )

  const handleEnded = useCallback(async () => {
    const s = mediaType === 'movie' ? 0 : currentSeason
    const e = mediaType === 'movie' ? 0 : currentEpisode

    await window.api.toggleMediaEpisodeCompleted(tmdbId, mediaType, s, e, true)

    if (mediaType === 'tv') {
      const nextEp = seasonDetail?.episodes?.find(
        (ep) => ep.episode_number === currentEpisode + 1
      )
      if (nextEp) {
        navigate(`/movies/watch/tv/${tmdbId}/${currentSeason}/${nextEp.episode_number}`, {
          replace: true
        })
      } else {
        const nextSeasonNum = currentSeason + 1
        const hasNextSeason = tvShow?.seasons?.some(
          (sv) => sv.season_number === nextSeasonNum
        )
        if (hasNextSeason) {
          navigate(`/movies/watch/tv/${tmdbId}/${nextSeasonNum}/1`, { replace: true })
        }
      }
    }
  }, [tmdbId, mediaType, currentSeason, currentEpisode, seasonDetail, tvShow, navigate])

  /* -- Navigation helpers ------------------------------------------------ */
  function handlePrevEpisode(): void {
    if (currentEpisode > 1) {
      navigate(`/movies/watch/tv/${tmdbId}/${currentSeason}/${currentEpisode - 1}`, {
        replace: true
      })
    } else if (currentSeason > 1) {
      navigate(`/movies/watch/tv/${tmdbId}/${currentSeason - 1}/1`, { replace: true })
    }
  }

  function handleNextEpisode(): void {
    const maxEp = seasonDetail?.episodes?.length ?? 0
    if (currentEpisode < maxEp) {
      navigate(`/movies/watch/tv/${tmdbId}/${currentSeason}/${currentEpisode + 1}`, {
        replace: true
      })
    } else {
      const nextSeason = currentSeason + 1
      if (tvShow?.seasons?.some((sv) => sv.season_number === nextSeason)) {
        navigate(`/movies/watch/tv/${tmdbId}/${nextSeason}/1`, { replace: true })
      }
    }
  }

  function getEpStatus(s: number, e: number): 'completed' | 'in-progress' | 'unwatched' {
    const p = episodeProgress.find(
      (pr) => pr.season_number === s && pr.episode_number === e
    )
    if (!p) return 'unwatched'
    if (p.completed) return 'completed'
    return 'in-progress'
  }

  /* -- Derived values ---------------------------------------------------- */
  const title =
    mediaType === 'movie'
      ? movie?.title || 'Loading...'
      : tvShow?.name || 'Loading...'

  const episodeTitle =
    mediaType === 'tv'
      ? `S${currentSeason} E${currentEpisode}${
          seasonDetail?.episodes?.find((ep) => ep.episode_number === currentEpisode)?.name
            ? ` - ${seasonDetail.episodes.find((ep) => ep.episode_number === currentEpisode)!.name}`
            : ''
        }`
      : ''

  const savedProgress = episodeProgress.find(
    (p) =>
      p.season_number === (mediaType === 'movie' ? 0 : currentSeason) &&
      p.episode_number === (mediaType === 'movie' ? 0 : currentEpisode)
  )
  const initialTime =
    savedProgress && !savedProgress.completed ? savedProgress.watched_seconds : 0

  const maxEpCount = seasonDetail?.episodes?.length ?? 0
  const canGoPrev = mediaType === 'tv' && (currentEpisode > 1 || currentSeason > 1)
  const canGoNext =
    mediaType === 'tv' &&
    (currentEpisode < maxEpCount ||
      tvShow?.seasons?.some((sv) => sv.season_number === currentSeason + 1))

  const providerName = EMBED_PROVIDERS[providerIndex].name

  /* -- Render ------------------------------------------------------------ */
  return (
    <div ref={pageRef} className="flex flex-col h-full bg-dark-950 relative theme-movies">
      {/* Invisible trigger zone at top edge */}
      <div
        className={`absolute top-0 left-0 right-0 z-40 ${isFullscreen ? 'h-12' : 'h-5'} ${controlsVisible ? 'pointer-events-none' : ''}`}
        onMouseEnter={handleTriggerEnter}
      />

      {/* Top bar -- auto-hides */}
      <div
        onMouseEnter={handleBarActivity}
        onMouseMove={handleBarActivity}
        onMouseLeave={handleBarActivity}
        className={`drag-region flex items-center justify-between px-4 py-2 bg-dark-900/90 backdrop-blur-sm border-b border-dark-800 shrink-0 absolute top-0 left-0 right-0 z-30 transition-all duration-300 ${isMac ? 'pl-20' : ''} ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/movies/detail/${mediaType}/${tmdbId}`, { replace: true })}
            className="no-drag btn-ghost text-sm"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="h-5 w-px bg-dark-700" />
          <h1 className="text-sm font-medium text-white truncate max-w-md">{title}</h1>
          {episodeTitle && (
            <span className="text-accent text-sm font-semibold">{episodeTitle}</span>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Provider switcher */}
          <button
            onClick={cycleProvider}
            className="no-drag flex items-center gap-1.5 bg-dark-800 text-white text-xs rounded px-2 py-1 border border-dark-700 hover:bg-dark-700 transition-colors"
            title="Switch streaming provider"
          >
            <RefreshCw size={12} />
            {providerName}
          </button>

          {/* TV episode navigation */}
          {mediaType === 'tv' && (
            <>
              <button
                onClick={handlePrevEpisode}
                disabled={!canGoPrev}
                className="no-drag btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <button
                onClick={() => setShowEpisodes(!showEpisodes)}
                className="no-drag btn-ghost text-sm"
              >
                <List size={16} />
                {currentEpisode} / {maxEpCount || '?'}
              </button>
              <button
                onClick={handleNextEpisode}
                disabled={!canGoNext}
                className="no-drag btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Window controls (non-macOS) */}
          {!isMac && (
            <>
              <div className="h-5 w-px bg-dark-700 ml-2" />
              <div className="no-drag flex items-center">
                <button
                  onClick={() => window.api.minimizeWindow()}
                  className="p-2 hover:bg-dark-700 rounded transition-colors"
                  title="Minimize"
                >
                  <Minus size={14} className="text-dark-300" />
                </button>
                <button
                  onClick={() => window.api.maximizeWindow()}
                  className="p-2 hover:bg-dark-700 rounded transition-colors"
                  title="Maximize"
                >
                  <Square size={12} className="text-dark-300" />
                </button>
                <button
                  onClick={() => window.api.closeWindow()}
                  className="p-2 hover:bg-red-500/20 rounded transition-colors"
                  title="Close"
                >
                  <X size={14} className="text-dark-300 hover:text-red-400" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex-1 flex flex-col relative transition-all duration-300 ${controlsVisible ? 'mt-11' : 'mt-0'}`}
        >
          {/* Loading state */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="animate-spin text-accent" />
                <p className="text-sm text-dark-400">Loading media info...</p>
              </div>
            </div>
          )}

          {/* Embed Player */}
          {!loading && embedUrl && (
            <EmbedPlayer
              src={embedUrl}
              title={`${title} ${episodeTitle}`}
              initialTime={initialTime}
              fullscreenTarget={pageRef as React.RefObject<HTMLElement>}
              onProgress={handleProgress}
              onEnded={handleEnded}
              onError={(msg) => console.error('[MoviesWatchPage] Embed error:', msg)}
            />
          )}
        </div>

        {/* Episode list sidebar (TV only) */}
        {showEpisodes && mediaType === 'tv' && (
          <div className="w-64 bg-dark-900 border-l border-dark-800 overflow-hidden shrink-0 flex flex-col">
            <div className="p-3 border-b border-dark-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Episodes</h3>
              <div className="relative">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                  className="appearance-none bg-dark-800 text-white text-xs rounded px-2 py-1 pr-6
                             border border-dark-700 focus:outline-none"
                >
                  {tvShow?.seasons
                    ?.filter((sv) => sv.season_number > 0)
                    .map((sv) => (
                      <option key={sv.season_number} value={sv.season_number}>
                        Season {sv.season_number}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {seasonDetail?.episodes?.map((ep) => {
                const status = getEpStatus(ep.season_number, ep.episode_number)
                const isCurrent =
                  ep.season_number === currentSeason &&
                  ep.episode_number === currentEpisode
                return (
                  <button
                    key={ep.id}
                    onClick={() =>
                      navigate(
                        `/movies/watch/tv/${tmdbId}/${ep.season_number}/${ep.episode_number}`,
                        { replace: true }
                      )
                    }
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                      isCurrent
                        ? 'bg-accent/20 text-accent'
                        : status === 'completed'
                          ? 'text-dark-500 hover:bg-dark-800'
                          : 'text-dark-300 hover:bg-dark-800'
                    }`}
                  >
                    <span className="font-medium">E{ep.episode_number}</span>
                    {ep.name && (
                      <span className="ml-1.5 text-dark-400 truncate">{ep.name}</span>
                    )}
                    {status === 'completed' && (
                      <span className="ml-auto text-green-500 text-[10px]"> ✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
