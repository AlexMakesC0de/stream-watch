import { useNavigate } from 'react-router-dom'
import { Play, X, Film } from 'lucide-react'
import { formatTimeLeft, progressPercent } from '@/lib/time'

/** One resume position, whichever catalogue it came from. */
export interface ResumeItem {
  key: string
  title: string
  image: string
  subtitle: string
  watched: number
  total: number
  href: string
  source: 'anime' | 'media'
  tmdbId?: number
  mediaType?: string
  anilistId?: number
}

interface ContinueWatchingRowProps {
  items: ResumeItem[]
  onRemove: (item: ResumeItem) => void
  loading?: boolean
  title?: string
}

/**
 * The product's thesis surface: everything you are part-way through, from both
 * catalogues, in one row. Landscape stills rather than posters, because what
 * matters here is where you are, not what the box looks like.
 */
export default function ContinueWatchingRow({
  items,
  onRemove,
  loading = false,
  title = 'Continue Watching'
}: ContinueWatchingRowProps): JSX.Element | null {
  const navigate = useNavigate()

  // Hold the row's space while the database answers. Returning null first and
  // the real row a moment later shoved every row below it down the page.
  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <Play size={17} className="text-accent-light" />
          <h2 className="text-[17px] font-semibold text-white">{title}</h2>
        </div>
        <div className="flex gap-4 overflow-hidden pb-3 -mx-1 px-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[286px] animate-pulse">
              <div className="aspect-video rounded-lg bg-dark-800" />
              <div className="mt-2.5 h-4 w-2/3 rounded bg-dark-800" />
              <div className="mt-1.5 h-3 w-1/3 rounded bg-dark-800" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <Play size={17} className="text-accent-light" />
        <h2 className="text-[17px] font-semibold text-white">{title}</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
        {items.map((item) => {
          const timeLeft = formatTimeLeft(item.watched, item.total)
          return (
            <div
              key={item.key}
              onClick={() => navigate(item.href)}
              className="group shrink-0 w-[286px] cursor-pointer"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-dark-800 anime-card">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={28} className="text-dark-600" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/95">
                    <Play size={20} className="text-dark-950 ml-0.5" fill="currentColor" />
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(item)
                  }}
                  title="Remove from Continue Watching"
                  aria-label={`Remove ${item.title} from Continue Watching`}
                  className="absolute top-2 right-2 p-1 rounded-md bg-dark-950/85 text-dark-300
                             opacity-0 group-hover:opacity-100 focus:opacity-100
                             hover:text-white hover:bg-dark-700 transition-all"
                >
                  <X size={13} />
                </button>

                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${progressPercent(item.watched, item.total)}%` }}
                  />
                </div>
              </div>

              <h3 className="mt-2.5 text-sm font-medium text-white truncate">{item.title}</h3>
              <p className="text-xs text-dark-400 mt-0.5 truncate tabular">
                {item.subtitle}
                {timeLeft && ` · ${timeLeft}`}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
