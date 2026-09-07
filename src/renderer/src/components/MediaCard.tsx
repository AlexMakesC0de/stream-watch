import { useNavigate } from 'react-router-dom'
import { Play, Star, Film, Tv, Bookmark } from 'lucide-react'
import { posterUrl, genreNames } from '@/services/tmdb'
import { useSaved, setSavedLocal } from '@/services/savedMedia'
import { useToast } from './Toast'
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
  const toast = useToast()

  // Toggle the title in/out of the library straight from the card. Optimistic:
  // flip the shared state immediately, then write to the DB and revert on error.
  async function applySave(next: boolean): Promise<void> {
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

  async function handleToggleSave(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    const next = !saved
    await applySave(next)
    toast({
      message: next ? `Added ${title} to My List` : `Removed ${title} from My List`,
      onUndo: () => applySave(!next)
    })
  }

  return (
    <div
      className="anime-card cursor-pointer group"
      onClick={() => navigate(`/movies/detail/${mediaType}/${media.id}`)}
    >
      {/* Poster */}
      <div className="card-art aspect-[2/3]">
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

        {/* Two controls, not three. Tiles are ~144px wide, so a third button
            overflowed and clipped; clicking the card already opens details, so
            the Info button was redundant as well as too wide. */}
        <div className="anime-card-overlay absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-transparent opacity-0 transition-opacity duration-200 flex items-end gap-1.5 p-2.5">
          <button
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-dark-50 hover:bg-white
                       text-dark-950 text-[13px] font-semibold px-2 py-1.5 rounded-md transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              navigate(
                mediaType === 'movie'
                  ? `/movies/watch/movie/${media.id}`
                  : `/movies/watch/tv/${media.id}/1/1`
              )
            }}
          >
            <Play size={13} fill="currentColor" />
            Play
          </button>
          <button
            onClick={handleToggleSave}
            className={`shrink-0 p-1.5 rounded-md border transition-colors ${
              saved
                ? 'bg-accent border-accent text-white'
                : 'bg-dark-900/95 border-dark-500 text-white hover:bg-dark-800 hover:border-dark-400'
            }`}
            title={saved ? 'Remove from My List' : 'Add to My List'}
            aria-label={saved ? 'Remove from My List' : 'Add to My List'}
          >
            <Bookmark
              size={14}
              className="text-white"
              fill={saved ? 'currentColor' : 'none'}
            />
          </button>
        </div>

        {/* Score. No type badge — a row of tiles all labelled MOVIE tells you
            nothing you did not already know from the row you are browsing. */}
        {media.vote_average > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/65 backdrop-blur-[2px] rounded text-[10px] font-semibold text-dark-100 tabular">
            <Star size={10} className="text-yellow-400" fill="currentColor" />
            {media.vote_average.toFixed(1)}
          </span>
        )}
      </div>

      {/* Caption, on the page ground */}
      <div className="pt-2.5">
        <h3 className="text-[13px] font-medium text-dark-100 leading-snug line-clamp-1">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-dark-400 mt-0.5 tabular">
          {year && <span>{year}</span>}
          {!isMovie(media) && (media as TMDBTvShow).number_of_seasons > 0 && (
            <span>· {(media as TMDBTvShow).number_of_seasons} season{(media as TMDBTvShow).number_of_seasons > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
