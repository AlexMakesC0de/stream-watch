// WebTorrent streaming manager — streams torrent video files via a local HTTP server.
// Only one torrent streams at a time; starting a new one stops the previous.

import http from 'http'
import { app } from 'electron'
import { join } from 'path'
import { rm } from 'fs/promises'

export interface TorrentProgress {
  downloaded: number
  total: number
  speed: number
  peers: number
  progress: number // 0–1
  ready: boolean
  streamUrl: string | null
}

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v']

const MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  webm: 'video/webm',
  mov: 'video/quicktime'
}

// Public trackers injected into every magnet to maximize peer discovery
const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorntime.app:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.opentrackr.org:1337',
  'udp://9.rarbg.me:2970/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce'
]

function injectTrackers(magnetUri: string): string {
  const existing = magnetUri.toLowerCase()
  for (const tracker of PUBLIC_TRACKERS) {
    if (!existing.includes(encodeURIComponent(tracker).toLowerCase()) &&
        !existing.includes(tracker.toLowerCase())) {
      magnetUri += `&tr=${encodeURIComponent(tracker)}`
    }
  }
  return magnetUri
}

class TorrentManager {
  private client: any = null
  private server: http.Server | null = null
  private currentTorrent: any = null
  private streamUrl: string | null = null
  private progressCallback: ((progress: TorrentProgress) => void) | null = null
  private progressInterval: ReturnType<typeof setInterval> | null = null
  private downloadPath: string

  constructor() {
    this.downloadPath = join(app.getPath('temp'), 'streamwatch-torrents')
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const WebTorrent = (await import('webtorrent')).default
      this.client = new WebTorrent()
    }
    return this.client
  }

  async startStream(
    magnetUri: string,
    onProgress: (progress: TorrentProgress) => void
  ): Promise<string> {
    // Stop any existing stream first
    await this.stopStream()

    this.progressCallback = onProgress

    if (!this.client) {
      this.client = await this.getClient()
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stopStream()
        reject(new Error('Torrent timed out — no peers found after 90 seconds'))
      }, 90000)

      // Inject public trackers for better peer discovery
      const enrichedMagnet = injectTrackers(magnetUri)

      this.client.add(enrichedMagnet, { path: this.downloadPath, announce: PUBLIC_TRACKERS }, (torrent: any) => {
        clearTimeout(timeout)
        this.currentTorrent = torrent

        // Find the largest video file
        const videoFile = torrent.files
          .filter((f: any) =>
            VIDEO_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
          )
          .sort((a: any, b: any) => b.length - a.length)[0]

        if (!videoFile) {
          this.stopStream()
          reject(new Error('No video file found in torrent'))
          return
        }

        // Deselect all files except the video to save bandwidth
        torrent.files.forEach((f: any) => f.deselect())
        videoFile.select()

        // Create local HTTP server with range-request support
        this.server = http.createServer((req, res) => {
          // CORS headers for renderer access
          res.setHeader('Access-Control-Allow-Origin', '*')
          if (req.method === 'OPTIONS') {
            res.writeHead(200)
            res.end()
            return
          }

          const ext = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4'
          const contentType = MIME_TYPES[ext] || 'video/mp4'
          const range = req.headers.range

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0])
            const end = parts[1] ? parseInt(parts[1]) : videoFile.length - 1
            const chunkSize = end - start + 1
            const stream = videoFile.createReadStream({ start, end })

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${videoFile.length}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': contentType
            })
            stream.pipe(res)
          } else {
            res.writeHead(200, {
              'Content-Length': videoFile.length,
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes'
            })
            videoFile.createReadStream().pipe(res)
          }
        })

        this.server.listen(0, '127.0.0.1', () => {
          const addr = this.server!.address() as { port: number }
          this.streamUrl = `http://127.0.0.1:${addr.port}`
          this.startProgressReporting()
          resolve(this.streamUrl)
        })

        torrent.on('error', (err: Error) => {
          console.error('Torrent error:', err.message)
        })
      })
    })
  }

  private startProgressReporting(): void {
    if (this.progressInterval) clearInterval(this.progressInterval)

    this.progressInterval = setInterval(() => {
      const torrent = this.currentTorrent as any
      if (!torrent || !this.progressCallback) return

      this.progressCallback({
        downloaded: torrent.downloaded,
        total: torrent.length,
        speed: torrent.downloadSpeed,
        peers: torrent.numPeers,
        progress: torrent.progress,
        ready: torrent.downloaded > 0,
        streamUrl: this.streamUrl
      })
    }, 1000)
  }

  async stopStream(): Promise<void> {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }

    this.progressCallback = null
    this.streamUrl = null

    if (this.server) {
      this.server.close()
      this.server = null
    }

    if (this.currentTorrent) {
      try {
        // Use client.remove() so WebTorrent de-registers the infohash,
        // preventing "Cannot add duplicate torrent" on the next add.
        if (this.client) {
          this.client.remove(this.currentTorrent)
        }
      } catch {
        // fallback: destroy directly
        try { (this.currentTorrent as any).destroy() } catch { /* ignore */ }
      }
      this.currentTorrent = null
    }
  }

  async destroy(): Promise<void> {
    await this.stopStream()

    if (this.client) {
      try {
        this.client.destroy()
      } catch {
        // ignore
      }
      this.client = null
    }

    // Cleanup temp files
    try {
      await rm(this.downloadPath, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

export const torrentManager = new TorrentManager()
