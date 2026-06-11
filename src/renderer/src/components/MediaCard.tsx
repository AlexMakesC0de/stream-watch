import { useNavigate } from 'react-router-dom'
import { Play, Star, Film, Tv, Bookmark } from 'lucide-react'
import { posterUrl, genreNames } from '@/services/tmdb'
import { useSaved, setSavedLocal } from '@/services/savedMedia'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem } from '@/types'

type MediaItem = TMDBMovie | TMDBTvShow | TMDBMediaItem

function isMovie(item: MediaItem): item is TMDBMovie {
  return 'title' in item
}

function getTitle(item: MediaItem): string {
  return isMovie(item) ? item.title : (item as TMDBTvShow).name
}

function getMediaType(item: MediaItem): 'movie' | 'tv' {
  if ('media_type' in item && item.media_type) return item.media_type as 'movie' | 'tv'
  return isMovie(item) ? 'movie' : 'tv'
}

function getYear(item: MediaItem): string {
  const date = isMovie(item) ? item.release_date : (item as TMDBTvShow).first_air_date
  return date ? date.substring(0, 4) : ''
}

interface MediaCardProps {
  media: MediaItem
}

export default function MediaCard({ media }: MediaCardProps): JSX.Element {
  const navigate = useNavigate()
  const title = getTitle(media)
  const mediaType = getMediaType(media)
  const year = getYear(media)
  const poster = posterUrl(media.poster_path)
  const saved = useSaved(media.id, mediaType)

  // Toggle the title in/out of the library straight from the card. Optimistic:
  // flip the shared state immediately, then write to the DB and revert on error.
  async function handleToggleSave(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    const next = !saved
    setSavedLocal(media.id, mediaType, next)
    try {
      if (next) {
        await window.api.addMedia({
          tmdbId: media.id,
          mediaType,
          title,
          posterPath: media.poster_path,
          backdropPath: media.backdrop_path ?? null,
          overview: media.overview ?? null,
          releaseDate: isMovie(media) ? media.release_date : (media as TMDBTvShow).first_air_date,
          voteAverage: media.vote_average,
          genres: JSON.stringify(genreNames(media.genre_ids, 99)),
          runtime: isMovie(media) ? (media as TMDBMovie).runtime ?? null : null,
          numberOfSeasons: !isMovie(media) ? (media as TMDBTvShow).number_of_seasons ?? null : null,
          numberOfEpisodes: !isMovie(media) ? (media as TMDBTvShow).number_of_episodes ?? null : null,
          status: 'PLAN_TO_WATCH'
        })
      } else {
        await window.api.removeMedia(media.id, mediaType)
      }
    } catch {
      setSavedLocal(media.id, mediaType, !next) // revert on failure
    }
  }

  return (
    <div
      className="anime-card cursor-pointer group"
      onClick={() => navigate(`/movies/detail/${mediaType}/${media.id}`)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-dark-800 flex items-center justify-center">
            {mediaType === 'movie' ? (
              <Film size={32} className="text-dark-600" />
            ) : (
              <Tv size={32} className="text-dark-600" />
            )}
          </div>
        )}

        {/* Hover overlay */}
        <div className="anime-card-overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity duration-200 flex items-end gap-2 p-3">
          <button
            className="btn-primary text-sm flex-1 justify-center"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/movies/detail/${mediaType}/${media.id}`)
            }}
          >
            <Play size={14} fill="currentColor" />
            Details
          </button>
          <button
            onClick={handleToggleSave}
            className="shrink-0 p-2 rounded-lg bg-dark-800/90 hover:bg-dark-700 transition-colors"
            title={saved ? 'Remove from library' : 'Add to Watchlist'}
          >
            <Bookmark
              size={16}
              className={saved ? 'text-accent' : 'text-white'}
              fill={saved ? 'currentColor' : 'none'}
            />
          </button>
        </div>

        {/* Type badge */}
        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-semibold text-dark-200 uppercase">
          {mediaType === 'movie' ? 'Movie' : 'TV'}
        </span>

        {/* Score */}
        {media.vote_average > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-semibold text-yellow-400">
            <Star size={10} fill="currentColor" />
            {media.vote_average.toFixed(1)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="text-sm font-medium text-white leading-tight line-clamp-2 mb-1 min-h-[2.2rem]">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-dark-400">
          {year && <span>{year}</span>}
          {!isMovie(media) && (media as TMDBTvShow).number_of_seasons > 0 && (
            <span>· {(media as TMDBTvShow).number_of_seasons} season{(media as TMDBTvShow).number_of_seasons > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
