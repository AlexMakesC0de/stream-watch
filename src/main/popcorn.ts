// Popcorn Time API client — fetches torrent magnet links for movies & TV episodes.
// Uses mirror round-robin with automatic failover.

import { getSetting } from './database'

const DEFAULT_MIRRORS = [
  'https://fusme.link',
  'https://jfper.link',
  'https://uxert.link',
  'https://yrkde.link'
]

function getMirrors(): string[] {
  try {
    const custom = getSetting('popcornMirrors')
    if (custom) {
      const parsed = custom.split(',').map((m) => m.trim()).filter(Boolean)
      if (parsed.length > 0) return parsed
    }
  } catch { /* db not ready yet, use defaults */ }
  return DEFAULT_MIRRORS
}

export interface PopcornTorrent {
  url: string // magnet URI
  seed: number
  peer: number
  size: string
  filesize: string
  quality: string
  provider: string
}

export type PopcornTorrents = Record<string, PopcornTorrent>

let currentMirrorIndex = 0

async function fetchWithFailover(path: string): Promise<unknown> {
  const mirrors = getMirrors()
  let lastError: Error | null = null

  for (let i = 0; i < mirrors.length; i++) {
    const mirrorIndex = (currentMirrorIndex + i) % mirrors.length
    const url = `${mirrors[mirrorIndex]}${path}`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      currentMirrorIndex = mirrorIndex // stick with working mirror
      return data
    } catch (err) {
      lastError = err as Error
      continue
    }
  }

  throw lastError || new Error('All Popcorn API mirrors failed')
}

export async function getMovieTorrents(imdbId: string): Promise<PopcornTorrents> {
  const data = (await fetchWithFailover(`/movie/${imdbId}`)) as {
    torrents?: { en?: PopcornTorrents }
  }
  return data?.torrents?.en || {}
}

export async function getShowEpisodeTorrents(
  imdbId: string,
  season: number,
  episode: number
): Promise<PopcornTorrents> {
  const data = (await fetchWithFailover(`/show/${imdbId}`)) as {
    episodes?: Array<{ season: number; episode: number; torrents: PopcornTorrents }>
  }
  const ep = data?.episodes?.find((e) => e.season === season && e.episode === episode)
  return ep?.torrents || {}
}
