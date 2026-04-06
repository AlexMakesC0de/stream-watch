// ─── AniList API Types ────────────────────────────────────────

export interface AniListAnime {
  id: number
  title: {
    romaji: string
    english: string | null
    native: string | null
  }
  coverImage: {
    large: string
    extraLarge: string
    color: string | null
  }
  bannerImage: string | null
  description: string | null
  episodes: number | null
  format: AnimeFormat
  status: AniListStatus
  season: AnimeSeason | null
  seasonYear: number | null
  genres: string[]
  averageScore: number | null
  popularity: number | null
  studios: {
    nodes: { name: string }[]
  }
  nextAiringEpisode: {
    airingAt: number
    episode: number
  } | null
  trailer: {
    id: string
    site: string
  } | null
  relations: {
    edges: {
      relationType: string
      node: {
        id: number
        title: { romaji: string; english: string | null }
        coverImage: { large: string }
        format: AnimeFormat
        type: string
      }
    }[]
  }
}

export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC'
export type AniListStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

// ─── Local Types ──────────────────────────────────────────────

export type WatchStatus = 'WATCHING' | 'COMPLETED' | 'PLAN_TO_WATCH' | 'ON_HOLD' | 'DROPPED'

export interface LocalAnime {
  id: number
  anilist_id: number
  title: string
  title_english: string | null
  cover_image: string | null
  banner_image: string | null
  description: string | null
  episodes_total: number | null
  status: WatchStatus
  format: string | null
  genres: string | null
  season: string | null
  season_year: number | null
  score: number | null
  added_at: string
  updated_at: string
}

export interface EpisodeProgress {
  id: number
  anime_id: number
  episode_number: number
  watched_seconds: number
  total_seconds: number
  completed: number // 0 or 1
  video_source: string | null
  watched_at: string
}

export interface ContinueWatchingItem extends LocalAnime {
  last_episode: number
  watched_seconds: number
  total_seconds: number
}

// ─── API response page info ───────────────────────────────────

export interface AniListPage {
  pageInfo: {
    total: number
    currentPage: number
    lastPage: number
    hasNextPage: boolean
  }
  media: AniListAnime[]
}

// ─── TMDB API Types ───────────────────────────────────────────

export type MediaType = 'movie' | 'tv'

export interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: { id: number; name: string }[]
  runtime: number | null
  status: string
  tagline: string | null
  popularity: number
  adult: boolean
  media_type?: 'movie'
  // from append_to_response
  credits?: {
    cast: TMDBCastMember[]
  }
  similar?: TMDBPage<TMDBMovie>
  recommendations?: TMDBPage<TMDBMovie>
  external_ids?: { imdb_id: string | null }
}

export interface TMDBTvShow {
  id: number
  name: string
  original_name: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: { id: number; name: string }[]
  number_of_seasons: number
  number_of_episodes: number
  status: string
  tagline: string | null
  popularity: number
  media_type?: 'tv'
  seasons?: TMDBSeason[]
  // from append_to_response
  credits?: {
    cast: TMDBCastMember[]
  }
  similar?: TMDBPage<TMDBTvShow>
  recommendations?: TMDBPage<TMDBTvShow>
  external_ids?: { imdb_id: string | null }
}

export interface TMDBSeason {
  id: number
  season_number: number
  name: string
  overview: string | null
  poster_path: string | null
  air_date: string | null
  episode_count: number
  episodes?: TMDBEpisode[]
}

export interface TMDBEpisode {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview: string | null
  still_path: string | null
  air_date: string | null
  runtime: number | null
  vote_average: number
}

export interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDBPage<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export type TMDBMediaItem = (TMDBMovie & { media_type: 'movie' }) | (TMDBTvShow & { media_type: 'tv' })

// ─── Local Media Types (Movies/TV) ───────────────────────────

export interface LocalMedia {
  id: number
  tmdb_id: number
  media_type: MediaType
  title: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string | null
  release_date: string | null
  vote_average: number | null
  genres: string | null
  runtime: number | null
  number_of_seasons: number | null
  number_of_episodes: number | null
  status: WatchStatus
  added_at: string
  updated_at: string
}

export interface MediaEpisodeProgress {
  id: number
  media_id: number
  season_number: number | null
  episode_number: number | null
  watched_seconds: number
  total_seconds: number
  completed: number
  watched_at: string
}

export interface MediaContinueWatchingItem extends LocalMedia {
  last_season: number | null
  last_episode: number | null
  watched_seconds: number
  total_seconds: number
}
