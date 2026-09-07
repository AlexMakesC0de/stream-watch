import { useRef } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import AnimeCard from './AnimeCard'
import type { AniListAnime } from '@/types'

interface AnimeRowProps {
  title: string
  anime: AniListAnime[]
  loading?: boolean
  Icon?: LucideIcon
}

/** Anime as a peer row on the unified home, in the same rhythm as film and TV. */
export default function AnimeRow({ title, anime, loading = false, Icon }: AnimeRowProps): JSX.Element | null {
  const scrollRef = useRef<HTMLDivElement>(null)

  function nudge(dir: number): void {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const showSkeleton = loading && anime.length === 0
  if (!loading && anime.length === 0) return null

  return (
    <section className="group/row">
      <div className="flex items-center justify-between mb-3 pr-1">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={17} className="text-accent-light shrink-0" />}
          <h2 className="text-[17px] font-semibold text-white">{title}</h2>
        </div>
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

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto overflow-y-hidden py-2 -mx-2 px-2 snap-x scroll-smooth"
      >
        {showSkeleton
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-36 sm:w-40 shrink-0 animate-pulse">
                <div className="aspect-[3/4] bg-dark-800 rounded-lg" />
                <div className="mt-2 h-4 bg-dark-800 rounded w-3/4" />
              </div>
            ))
          : anime.map((a) => (
              <div key={a.id} className="shrink-0 snap-start w-36 sm:w-40">
                <AnimeCard anime={a} />
              </div>
            ))}
      </div>
    </section>
  )
}
