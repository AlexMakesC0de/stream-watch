import { useNavigate } from 'react-router-dom'
import { Play, Star, Bookmark } from 'lucide-react'
import { useAnimeSaved, setAnimeSavedLocal } from '@/services/savedAnime'
import { stripHtml } from '@/services/anilist'
import { useToast } from './Toast'
import type { AniListAnime } from '@/types'

interface AnimeCardProps {
  anime: AniListAnime
  showProgress?: {
    watched: number
    total: number
  }
}

export default function AnimeCard({ anime, showProgress }: AnimeCardProps): JSX.Element {
  const navigate = useNavigate()
  const title = anime.title.english || anime.title.romaji
  const saved = useAnimeSaved(anime.id)
  const toast = useToast()

  // Same optimistic save the media cards use, against the anime tables.
  async function applySave(next: boolean): Promise<void> {
    setAnimeSavedLocal(anime.id, next)
    try {
      if (next) {
        await window.api.addAnime({
          anilistId: anime.id,
          title: anime.title.romaji,
          titleEnglish: anime.title.english,
          coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
          bannerImage: anime.bannerImage,
          description: stripHtml(anime.description),
          episodesTotal: anime.episodes,
          status: 'PLAN_TO_WATCH',
          format: anime.format,
          genres: JSON.stringify(anime.genres),
          season: anime.season,
          seasonYear: anime.seasonYear,
          score: anime.averageScore ? anime.averageScore / 10 : null
        })
      } else {
        await window.api.removeAnime(anime.id)
      }
    } catch {
      setAnimeSavedLocal(anime.id, !next)
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
      onClick={() => navigate(`/anime/detail/${anime.id}`)}
    >
      {/* Cover Image */}
      <div className="card-art aspect-[3/4]">
        <img
          src={anime.coverImage.large}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Same two controls as a film or series tile: play, and save. */}
        <div className="anime-card-overlay absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-transparent opacity-0 transition-opacity duration-200 flex items-end gap-1.5 p-2.5">
          <button
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-dark-50 hover:bg-white
                       text-dark-950 text-[13px] font-semibold px-2 py-1.5 rounded-md transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/anime/watch/${anime.id}/1`)
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

        {/* Score */}
        {anime.averageScore && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/65 backdrop-blur-[2px] rounded text-[10px] font-semibold text-dark-100 tabular">
            <Star size={10} className="text-yellow-400" fill="currentColor" />
            {(anime.averageScore / 10).toFixed(1)}
          </span>
        )}

        {/* Episode progress bar */}
        {showProgress && (
          <div className="absolute bottom-0 left-0 right-0">
            <div className="progress-bar rounded-none h-0.5">
              <div
                className="progress-bar-fill rounded-none"
                style={{ width: `${(showProgress.watched / Math.max(showProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Caption, on the page ground. Genre chips lived here too; in a row of
          tiles they read as clutter and the detail page already lists them. */}
      <div className="pt-2.5">
        <h3 className="text-[13px] font-medium text-dark-100 leading-snug line-clamp-1">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-dark-400 mt-0.5 tabular">
          {anime.seasonYear && <span>{anime.seasonYear}</span>}
          {anime.episodes && <span>· {anime.episodes} eps</span>}
        </div>
      </div>
    </div>
  )
}
