import { useCallback, useEffect, useState } from 'react'
import { posterUrl, backdropUrl } from '@/services/tmdb'
import type { ResumeItem } from '@/components/ContinueWatchingRow'
import type { MediaContinueWatchingItem, ContinueWatchingItem } from '@/types'

/** Which catalogue a surface wants back. */
export type ResumeKind = 'all' | 'movie' | 'tv' | 'anime'

interface UseContinueWatching {
  items: ResumeItem[]
  loading: boolean
  remove: (item: ResumeItem) => Promise<void>
}

/**
 * Resume positions for one surface. Home asks for everything; each browse page
 * asks for its own catalogue, so Movies and Series get the same "pick up where
 * you left off" row that anime always had.
 */
export function useContinueWatching(kind: ResumeKind = 'all'): UseContinueWatching {
  const [items, setItems] = useState<ResumeItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const wantsMedia = kind === 'all' || kind === 'movie' || kind === 'tv'
    const wantsAnime = kind === 'all' || kind === 'anime'

    const [mediaRes, animeRes] = await Promise.all([
      wantsMedia ? window.api.getMediaContinueWatching().catch(() => []) : Promise.resolve([]),
      wantsAnime ? window.api.getContinueWatching().catch(() => []) : Promise.resolve([])
    ])

    const media: ResumeItem[] = (mediaRes as MediaContinueWatchingItem[])
      .filter((m) => (kind === 'all' ? true : m.media_type === kind))
      .map((m) => ({
        key: `media-${m.media_type}-${m.tmdb_id}`,
        title: m.title,
        image: m.backdrop_path
          ? backdropUrl(m.backdrop_path, 'w780')
          : posterUrl(m.poster_path, 'w342'),
        subtitle: m.media_type === 'tv' ? `S${m.last_season} E${m.last_episode}` : 'Film',
        watched: m.watched_seconds,
        total: m.total_seconds,
        href:
          m.media_type === 'movie'
            ? `/movies/watch/movie/${m.tmdb_id}`
            : `/movies/watch/tv/${m.tmdb_id}/${m.last_season || 1}/${m.last_episode || 1}`,
        source: 'media',
        tmdbId: m.tmdb_id,
        mediaType: m.media_type
      }))

    const anime: ResumeItem[] = (animeRes as ContinueWatchingItem[]).map((a) => ({
      key: `anime-${a.anilist_id}`,
      title: a.title_english || a.title,
      image: a.banner_image || a.cover_image || '',
      subtitle: `Episode ${a.last_episode}`,
      watched: a.watched_seconds,
      total: a.total_seconds,
      href: `/anime/watch/${a.anilist_id}/${a.last_episode}`,
      source: 'anime',
      anilistId: a.anilist_id
    }))

    setItems([...media, ...anime])
    setLoading(false)
  }, [kind])

  useEffect(() => {
    load()
  }, [load])

  const remove = useCallback(async (item: ResumeItem) => {
    setItems((list) => list.filter((i) => i.key !== item.key))
    try {
      if (item.source === 'media' && item.tmdbId && item.mediaType) {
        await window.api.removeMediaFromContinueWatching(item.tmdbId, item.mediaType)
      } else if (item.source === 'anime' && item.anilistId) {
        await window.api.removeAnimeFromContinueWatching(item.anilistId)
      }
    } catch {
      load() // put the row back the way the database actually has it
    }
  }, [load])

  return { items, loading, remove }
}
