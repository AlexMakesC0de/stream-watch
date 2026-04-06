import MediaCard from './MediaCard'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem } from '@/types'

type MediaItem = TMDBMovie | TMDBTvShow | TMDBMediaItem

interface MediaGridProps {
  media: MediaItem[]
  loading?: boolean
}

export default function MediaGrid({ media, loading }: MediaGridProps): JSX.Element {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] bg-dark-800 rounded-lg" />
            <div className="mt-2 h-4 bg-dark-800 rounded w-3/4" />
            <div className="mt-1 h-3 bg-dark-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-12 text-dark-500">
        <p>No results found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {media.map((item) => (
        <MediaCard key={`${('title' in item ? 'movie' : 'tv')}-${item.id}`} media={item} />
      ))}
    </div>
  )
}
