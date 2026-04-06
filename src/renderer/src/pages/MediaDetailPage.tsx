import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play,
  Star,
  Calendar,
  Clock,
  ArrowLeft,
  Film,
  Tv,
  ChevronDown
} from 'lucide-react'
import StatusSelector from '@/components/StatusSelector'
import MediaGrid from '@/components/MediaGrid'
import {
  getMovieDetails,
  getTvShowDetails,
  getTvSeasonDetails,
  posterUrl,
  backdropUrl
} from '@/services/tmdb'
import type {
  TMDBMovie,
  TMDBTvShow,
  TMDBSeason,
  TMDBEpisode,
  LocalMedia,
  WatchStatus,
  MediaEpisodeProgress,
  MediaType
} from '@/types'

export default function MediaDetailPage(): JSX.Element {
  const { type, id } = useParams<{ type: string; id: string }>()
  const navigate = useNavigate()
  const isMac = navigator.userAgent.includes('Macintosh')
  const mediaType = type as MediaType
  const tmdbId = parseInt(id || '0')

  const [movie, setMovie] = useState<TMDBMovie | null>(null)
  const [tvShow, setTvShow] = useState<TMDBTvShow | null>(null)
  const [localMedia, setLocalMedia] = useState<LocalMedia | null>(null)
  const [episodeProgress, setEpisodeProgress] = useState<MediaEpisodeProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)

  // TV-specific
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [seasonDetail, setSeasonDetail] = useState<TMDBSeason | null>(null)
  const [seasonLoading, setSeasonLoading] = useState(false)

  useEffect(() => {
    if (tmdbId) loadDetails()
  }, [tmdbId, mediaType])

  useEffect(() => {
    if (mediaType === 'tv' && tvShow && selectedSeason) {
      loadSeasonDetail(selectedSeason)
    }
  }, [selectedSeason, tvShow])

  async function loadDetails(): Promise<void> {
    setLoading(true)
    try {
      const [local, progress] = await Promise.all([
        window.api.getMedia(tmdbId, mediaType) as Promise<LocalMedia | null>,
        window.api.getMediaProgress(tmdbId, mediaType) as Promise<MediaEpisodeProgress[]>
      ])
      setLocalMedia(local)
      setEpisodeProgress(progress)

      if (mediaType === 'movie') {
        const data = await getMovieDetails(tmdbId)
        setMovie(data)
      } else {
        const data = await getTvShowDetails(tmdbId)
        setTvShow(data)
        // Default to first season that isn't "Specials" (season 0)
        const firstReal = data.seasons?.find((s) => s.season_number > 0)
        if (firstReal) setSelectedSeason(firstReal.season_number)
      }
    } catch (error) {
      console.error('Failed to load details:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadSeasonDetail(seasonNum: number): Promise<void> {
    setSeasonLoading(true)
    try {
      const data = await getTvSeasonDetails(tmdbId, seasonNum)
      setSeasonDetail(data)
    } catch (error) {
      console.error('Failed to load season:', error)
    } finally {
      setSeasonLoading(false)
    }
  }

  async function handleStatusChange(status: WatchStatus): Promise<void> {
    const title = mediaType === 'movie' ? movie?.title : tvShow?.name
    if (!title) return

    if (localMedia) {
      await window.api.updateMediaStatus(tmdbId, mediaType, status)
    } else {
      const detail = mediaType === 'movie' ? movie : tvShow
      if (!detail) return
      await window.api.addMedia({
        tmdbId,
        mediaType,
        title,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        overview: detail.overview,
        releaseDate: mediaType === 'movie' ? (detail as TMDBMovie).release_date : (detail as TMDBTvShow).first_air_date,
        voteAverage: detail.vote_average,
        genres: JSON.stringify(detail.genres?.map((g) => g.name) || []),
        runtime: mediaType === 'movie' ? (detail as TMDBMovie).runtime : null,
        numberOfSeasons: mediaType === 'tv' ? (detail as TMDBTvShow).number_of_seasons : null,
        numberOfEpisodes: mediaType === 'tv' ? (detail as TMDBTvShow).number_of_episodes : null,
        status
      })
    }

    const updated = (await window.api.getMedia(tmdbId, mediaType)) as LocalMedia
    setLocalMedia(updated)
  }

  async function handleRemove(): Promise<void> {
    await window.api.removeMedia(tmdbId, mediaType)
    setLocalMedia(null)
  }

  function handleWatchMovie(): void {
    navigate(`/movies/watch/movie/${tmdbId}`)
  }

  function handleWatchEpisode(season: number, episode: number): void {
    navigate(`/movies/watch/tv/${tmdbId}/${season}/${episode}`)
  }

  const getEpStatus = (season: number, ep: number): 'completed' | 'in-progress' | 'unwatched' => {
    const p = episodeProgress.find(
      (pr) => pr.season_number === season && pr.episode_number === ep
    )
    if (!p) return 'unwatched'
    if (p.completed) return 'completed'
    return 'in-progress'
  }

  if (loading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-56 bg-dark-800 rounded-lg mb-6" />
        <div className="flex gap-6">
          <div className="w-48 h-72 bg-dark-800 rounded-lg shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-dark-800 rounded w-2/3" />
            <div className="h-4 bg-dark-800 rounded w-1/3" />
            <div className="h-20 bg-dark-800 rounded" />
          </div>
        </div>
      </div>
    )
  }

  const detail = mediaType === 'movie' ? movie : tvShow
  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full text-dark-500">
        <p>Not found</p>
      </div>
    )
  }

  const title = mediaType === 'movie' ? (detail as TMDBMovie).title : (detail as TMDBTvShow).name
  const overview = detail.overview || ''
  const backdrop = backdropUrl(detail.backdrop_path)
  const poster = posterUrl(detail.poster_path, 'w342')
  const genres = detail.genres?.map((g) => g.name) || []
  const releaseYear = mediaType === 'movie'
    ? (detail as TMDBMovie).release_date?.substring(0, 4)
    : (detail as TMDBTvShow).first_air_date?.substring(0, 4)
  const similar = mediaType === 'movie'
    ? (detail as TMDBMovie).similar?.results.slice(0, 12) || []
    : (detail as TMDBTvShow).similar?.results.slice(0, 12) || []

  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative h-64 overflow-hidden">
        {backdrop ? (
          <img src={backdrop} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-dark-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className={`absolute top-4 btn-ghost bg-black/40 backdrop-blur-sm ${isMac ? 'left-20' : 'left-4'}`}
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="px-6 -mt-32 relative z-10">
        <div className="flex gap-6">
          {/* Poster */}
          <div className="shrink-0">
            {poster ? (
              <img src={poster} alt={title} className="w-48 h-72 object-cover rounded-lg shadow-2xl" />
            ) : (
              <div className="w-48 h-72 bg-dark-800 rounded-lg shadow-2xl flex items-center justify-center">
                {mediaType === 'movie' ? <Film size={40} className="text-dark-600" /> : <Tv size={40} className="text-dark-600" />}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-20">
            <h1 className="text-3xl font-bold text-white leading-tight">{title}</h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-dark-300">
              {detail.vote_average > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star size={14} fill="currentColor" />
                  {detail.vote_average.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                {mediaType === 'movie' ? <Film size={14} /> : <Tv size={14} />}
                {mediaType === 'movie' ? 'Movie' : 'TV Show'}
              </span>
              {mediaType === 'movie' && (detail as TMDBMovie).runtime && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {(detail as TMDBMovie).runtime} min
                </span>
              )}
              {mediaType === 'tv' && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {(detail as TMDBTvShow).number_of_seasons} season{(detail as TMDBTvShow).number_of_seasons > 1 ? 's' : ''}
                  {' · '}
                  {(detail as TMDBTvShow).number_of_episodes} episodes
                </span>
              )}
              {releaseYear && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {releaseYear}
                </span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mt-3">
              {genres.map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 bg-dark-800 rounded-full text-xs text-dark-300 font-medium"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-5">
              <StatusSelector
                currentStatus={localMedia?.status as WatchStatus || null}
                onStatusChange={handleStatusChange}
                onRemove={handleRemove}
              />
              {mediaType === 'movie' && (
                <button onClick={handleWatchMovie} className="btn-primary">
                  <Play size={16} fill="currentColor" />
                  Watch Now
                </button>
              )}
              {mediaType === 'tv' && seasonDetail?.episodes && seasonDetail.episodes.length > 0 && (
                <button
                  onClick={() => {
                    // Find next unwatched episode
                    const nextEp = seasonDetail.episodes?.find(
                      (ep) => getEpStatus(selectedSeason, ep.episode_number) !== 'completed'
                    )
                    const ep = nextEp || seasonDetail.episodes![0]
                    handleWatchEpisode(selectedSeason, ep.episode_number)
                  }}
                  className="btn-primary"
                >
                  <Play size={16} fill="currentColor" />
                  {episodeProgress.length > 0 ? 'Continue Watching' : 'Start Watching'}
                </button>
              )}
            </div>

            {/* Description */}
            {overview && (
              <div className="mt-6">
                <p
                  className={`text-sm text-dark-300 leading-relaxed ${
                    !descExpanded ? 'line-clamp-4' : ''
                  }`}
                >
                  {overview}
                </p>
                {overview.length > 300 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-accent text-sm mt-1 hover:underline"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* TV Season/Episode browser */}
        {mediaType === 'tv' && tvShow?.seasons && (
          <section className="mt-8 pb-4">
            {/* Season selector */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-white">Episodes</h2>
              <div className="relative">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                  className="appearance-none bg-dark-800 text-white text-sm rounded-lg px-3 py-1.5 pr-8
                             border border-dark-700 focus:outline-none focus:border-accent cursor-pointer"
                >
                  {tvShow.seasons
                    .filter((s) => s.season_number > 0)
                    .map((s) => (
                      <option key={s.season_number} value={s.season_number}>
                        Season {s.season_number} ({s.episode_count} eps)
                      </option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
              </div>
            </div>

            {/* Episodes list */}
            {seasonLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 bg-dark-900 rounded-lg p-3">
                    <div className="w-28 h-16 bg-dark-800 rounded shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-dark-800 rounded w-1/3 mb-1" />
                      <div className="h-3 bg-dark-800 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {seasonDetail?.episodes?.map((ep) => {
                  const status = getEpStatus(selectedSeason, ep.episode_number)
                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleWatchEpisode(selectedSeason, ep.episode_number)}
                      className={`flex items-center gap-3 bg-dark-900 hover:bg-dark-800 rounded-lg p-3
                                 transition-colors cursor-pointer group ${
                                   status === 'completed' ? 'opacity-60' : ''
                                 }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-28 h-16 bg-dark-800 rounded shrink-0 overflow-hidden relative">
                        {ep.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={20} className="text-dark-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <Play size={20} className="text-white" fill="currentColor" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">
                          {ep.episode_number}. {ep.name}
                        </h4>
                        {ep.overview && (
                          <p className="text-xs text-dark-400 line-clamp-2 mt-0.5">
                            {ep.overview}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-dark-500 mt-1">
                          {ep.runtime && <span>{ep.runtime} min</span>}
                          {ep.air_date && <span>{ep.air_date}</span>}
                        </div>
                      </div>

                      {/* Status */}
                      {status === 'completed' && (
                        <span className="text-accent text-xs font-medium shrink-0">Watched</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Similar */}
        {similar.length > 0 && (
          <section className="mt-4 pb-8">
            <h2 className="text-lg font-bold text-white mb-4">Similar</h2>
            <MediaGrid media={similar.map((s) => ({ ...s, media_type: mediaType }))} />
          </section>
        )}
      </div>
    </div>
  )
}
