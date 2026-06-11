import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import MediaCard from './MediaCard'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem } from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem

function itemType(item: AnyMedia): 'movie' | 'tv' {
  if ('media_type' in item && item.media_type) return item.media_type
  return 'title' in item ? 'movie' : 'tv'
}

interface MediaRowProps {
  title: string
  Icon?: LucideIcon
  /** Renders the title as a small uppercase pill (e.g. "TOP 10"). */
  badge?: string
  items: AnyMedia[]
  ranked?: boolean
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  /** Slot on the right of the header (e.g. a provider dropdown). */
  headerRight?: ReactNode
}

export default function MediaRow({
  title,
  Icon,
  badge,
  items,
  ranked = false,
  loading = false,
  hasMore = false,
  onLoadMore,
  headerRight
}: MediaRowProps): JSX.Element | null {
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el || !onLoadMore || !hasMore || loading) return
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 600) onLoadMore()
  }

  function nudge(dir: number): void {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const showSkeleton = loading && items.length === 0

  // Hide a row that finished loading with nothing (e.g. unavailable provider).
  if (!loading && items.length === 0) return null

  return (
    <section className="group/row">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pr-1">
        <div className="flex items-center gap-2.5">
          {badge ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/15 text-accent text-xs font-extrabold uppercase tracking-wider">
              {Icon && <Icon size={13} />}
              {badge}
            </span>
          ) : (
            Icon && <Icon size={20} className="text-accent" />
          )}
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button
              onClick={() => nudge(-1)}
              className="p-1.5 rounded-full bg-dark-800 hover:bg-dark-700 text-white transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => nudge(1)}
              className="p-1.5 rounded-full bg-dark-800 hover:bg-dark-700 text-white transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal scroller */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto overflow-y-hidden py-2 -mx-2 px-2 snap-x scroll-smooth"
      >
        {showSkeleton
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-36 sm:w-40 shrink-0 animate-pulse">
                <div className="aspect-[2/3] bg-dark-800 rounded-lg" />
                <div className="mt-2 h-4 bg-dark-800 rounded w-3/4" />
              </div>
            ))
          : items.map((item, i) => (
              <div
                key={`${itemType(item)}-${item.id}-${i}`}
                className={`shrink-0 snap-start ${ranked ? 'flex items-end' : ''}`}
              >
                {ranked && (
                  <span
                    className="text-[5rem] leading-[0.8] font-black text-dark-900 -mr-4 select-none"
                    style={{ WebkitTextStroke: '2px #4c4d52' }}
                  >
                    {i + 1}
                  </span>
                )}
                <div className="w-36 sm:w-40">
                  <MediaCard media={item} />
                </div>
              </div>
            ))}

        {/* Trailing loader while appending more */}
        {!showSkeleton && loading && items.length > 0 && (
          <div className="w-36 sm:w-40 shrink-0 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </section>
  )
}
