import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Info, Star } from 'lucide-react'
import { backdropUrl, posterUrl, genreNames } from '@/services/tmdb'
import type { TMDBMediaItem } from '@/types'

interface HeroSlideshowProps {
  items: TMDBMediaItem[]
}

/** How long each slide is held, in ms. Drives both the timer bar and the switch. */
const SLIDE_MS = 4000

export default function HeroSlideshow({ items }: HeroSlideshowProps): JSX.Element | null {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  // Hovering or tabbing into the hero holds the current slide. Rotating a
  // synopsis out from under someone mid-sentence is the same class of
  // annoyance as auto-advancing an episode.
  const [paused, setPaused] = useState(false)

  const slides = items.filter((i) => i.backdrop_path).slice(0, 6)

  // Reserve the hero's space while trending loads. Returning null here made the
  // whole page jump down the moment data arrived.
  if (slides.length === 0) {
    return (
      <div className="relative h-[72vh] min-h-[520px] max-h-[820px] bg-dark-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-dark-950 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-end px-8 pb-14 max-w-[46rem] animate-pulse">
          <div className="h-12 w-2/3 rounded bg-dark-800" />
          <div className="h-4 w-40 rounded bg-dark-800 mt-5" />
          <div className="h-4 w-full rounded bg-dark-800 mt-4" />
          <div className="h-4 w-4/5 rounded bg-dark-800 mt-2" />
          <div className="flex gap-3 mt-6">
            <div className="h-11 w-32 rounded-md bg-dark-800" />
            <div className="h-11 w-36 rounded-md bg-dark-800" />
          </div>
        </div>
      </div>
    )
  }

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
    <div
      className="relative h-[72vh] min-h-[520px] max-h-[820px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
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
      {/* Scrims only: one from the left to hold the copy, one from the bottom
          to hand off into the first row. Never gradient as ornament. */}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/75 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-dark-950 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end px-8 pb-14 max-w-[46rem]">
        <h1 className="text-[3.25rem] leading-[1.03] font-extrabold text-white tracking-[-0.03em]">
          {title}
        </h1>

        {/* Plain, dot-separated metadata — the canon never sets these as pills
            and never labels the content type. */}
        <div className="flex flex-wrap items-center gap-2 mt-4 text-sm text-dark-200">
          {item.vote_average > 0 && (
            <>
              <span className="flex items-center gap-1.5 text-white font-medium tabular">
                <Star size={13} className="text-yellow-400" fill="currentColor" />
                {item.vote_average.toFixed(1)}
              </span>
              <span aria-hidden className="text-dark-500">·</span>
            </>
          )}
          {year && (
            <>
              <span className="tabular">{year}</span>
              {genres.length > 0 && <span aria-hidden className="text-dark-500">·</span>}
            </>
          )}
          {genres.length > 0 && <span>{genres.join(', ')}</span>}
        </div>

        {item.overview && (
          <p className="text-dark-200 mt-3 line-clamp-3 text-sm leading-relaxed">{item.overview}</p>
        )}

        <div className="flex items-center gap-3 mt-6">
          <button onClick={() => navigate(watchPath)} className="btn-hero">
            <Play size={18} fill="currentColor" />
            Play
          </button>
          <button
            onClick={() => navigate(`/movies/detail/${isMovie ? 'movie' : 'tv'}/${item.id}`)}
            className="btn-secondary px-5 py-2.5"
          >
            <Info size={18} />
            More Info
          </button>
        </div>
      </div>

      {/* Queued titles — posters rather than dots, so you can see (and jump
          straight to) what's coming instead of waiting to find out. */}
      <div className="absolute bottom-14 right-8 z-10 flex items-end gap-2">
        {slides.map((s, i) => {
          const slideTitle = s.media_type === 'movie' ? s.title : s.name
          return (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ${slideTitle}`}
              aria-current={i === index}
              title={slideTitle}
              className={`relative overflow-hidden rounded-md border transition-all duration-200 ${
                i === index
                  ? 'w-14 h-20 border-accent shadow-lg'
                  : 'w-11 h-16 border-white/20 opacity-60 hover:opacity-100 hover:border-white/60'
              }`}
            >
              {s.poster_path ? (
                <img
                  src={posterUrl(s.poster_path, 'w154')}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-dark-800" />
              )}
            </button>
          )
        })}
      </div>

      {/* Auto-advance timer — a hairline that fills left to right, then hands
          over to the next slide. Hovering the hero freezes it mid-fill. */}
      {slides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <div
            key={index}
            onAnimationEnd={() => setIndex((p) => (p + 1) % slides.length)}
            style={{
              animationDuration: `${SLIDE_MS}ms`,
              animationPlayState: paused ? 'paused' : 'running'
            }}
            className="hero-timer-fill h-full bg-white/50"
          />
        </div>
      )}
    </div>
  )
}
