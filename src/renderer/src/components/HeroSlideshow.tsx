import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Info, Star } from 'lucide-react'
import { backdropUrl, genreNames } from '@/services/tmdb'
import type { TMDBMediaItem } from '@/types'

interface HeroSlideshowProps {
  items: TMDBMediaItem[]
}

export default function HeroSlideshow({ items }: HeroSlideshowProps): JSX.Element | null {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  const slides = items.filter((i) => i.backdrop_path).slice(0, 6)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => setIndex((p) => (p + 1) % slides.length), 7000)
    return () => clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  const item = slides[Math.min(index, slides.length - 1)]
  const isMovie = item.media_type === 'movie'
  const title = item.media_type === 'movie' ? item.title : item.name
  const date = item.media_type === 'movie' ? item.release_date : item.first_air_date
  const year = date ? date.slice(0, 4) : ''
  const genres = genreNames(item.genre_ids, 2)
  const watchPath = isMovie
    ? `/movies/watch/movie/${item.id}`
    : `/movies/watch/tv/${item.id}/1/1`

  return (
    <div className="relative h-[420px] rounded-2xl overflow-hidden">
      {/* Crossfading backdrops */}
      {slides.map((s, i) => (
        <img
          key={s.id}
          src={backdropUrl(s.backdrop_path, 'w1280')}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-8 max-w-2xl">
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg leading-tight">{title}</h1>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
          {item.vote_average > 0 && (
            <span className="flex items-center gap-1 text-yellow-400 font-semibold">
              <Star size={14} fill="currentColor" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
          {year && <span className="text-dark-200">{year}</span>}
          {genres[0] && <span className="px-2 py-0.5 rounded bg-white/10 text-white">{genres[0]}</span>}
          {genres[1] && <span className="px-2 py-0.5 rounded bg-white/10 text-white">{genres[1]}</span>}
          <span className="px-2 py-0.5 rounded bg-white/10 text-white uppercase text-xs font-semibold">
            {isMovie ? 'Movie' : 'TV'}
          </span>
        </div>

        {item.overview && (
          <p className="text-dark-200 mt-3 line-clamp-3 text-sm leading-relaxed">{item.overview}</p>
        )}

        <div className="flex items-center gap-3 mt-5">
          <button onClick={() => navigate(watchPath)} className="btn-primary px-6">
            <Play size={18} fill="currentColor" />
            Play
          </button>
          <button
            onClick={() => navigate(`/movies/detail/${isMovie ? 'movie' : 'tv'}/${item.id}`)}
            className="btn-secondary px-6"
          >
            <Info size={18} />
            See more
          </button>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-5 right-8 z-10 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-accent' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
