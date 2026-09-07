import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { BrowserWindow, net } from 'electron'
import { URL } from 'url'
import { Readable } from 'stream'
import { randomBytes, timingSafeEqual } from 'crypto'

// ─── Local HLS Proxy ──────────────────────────────────────────
// The CDN is behind Cloudflare. We keep the hidden BrowserWindow
// alive from extraction and use its session.fetch() to make
// requests through Chromium's network stack, which carries CF
// cookies, TLS fingerprint, and HSTS state. We strip
// referrer-policy and CSP from CDN responses via the session's
// webRequest hooks (set up in gogoanime.ts) so Chromium allows
// cross-origin Referer in ses.fetch() calls.

let server: Server | null = null
let proxyPort = 0

/**
 * Capability token, regenerated every launch.
 *
 * The proxy fetches whatever URL it is handed using the extractor session's
 * cookies. Binding to 127.0.0.1 keeps the network out, but any other local
 * process — or a hostile page inside the embed webview that guesses the port —
 * could otherwise use it as an authenticated open relay. Only code that got a
 * URL from toProxyUrl() knows this token.
 */
let proxyToken = ''

/** Constant-time compare so the token cannot be recovered by timing. */
function tokenMatches(candidate: string | null): boolean {
  if (!candidate || !proxyToken) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(proxyToken)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Refuse anything that is not an ordinary remote http(s) URL. Without this the
 * proxy is an SSRF primitive pointed at the user's own machine and LAN.
 */
function isSafeTarget(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false
  if (host === '::1' || host === '::' || host === '0.0.0.0') return false
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return false

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 127 || a === 0 || a === 10) return false // loopback, this-host, private
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata
    if (a === 192 && b === 168) return false // private
    if (a === 172 && b >= 16 && b <= 31) return false // private
  }
  return true
}

/** The hidden BrowserWindow that passed Cloudflare's challenge */
let extractorWindow: BrowserWindow | null = null


export function setExtractorWindow(win: BrowserWindow, referer: string): void {
  // Clean up previous window if any
  if (extractorWindow && !extractorWindow.isDestroyed()) {
    extractorWindow.destroy()
  }
  extractorWindow = win
  void referer // net.fetch deliberately sends no Referer; see sessionFetch
}

export function getExtractorWindow(): BrowserWindow | null {
  if (extractorWindow && !extractorWindow.isDestroyed()) return extractorWindow
  return null
}

export function cleanupExtractorWindow(): void {
  if (extractorWindow && !extractorWindow.isDestroyed()) {
    extractorWindow.destroy()
  }
  extractorWindow = null
}

/**
 * Convert a real CDN URL to a proxied localhost URL.
 */
export function toProxyUrl(realUrl: string): string {
  return `http://127.0.0.1:${proxyPort}/proxy?t=${proxyToken}&url=${encodeURIComponent(realUrl)}`
}

/**
 * Start the local proxy server. Call once at app startup.
 */
export function startProxyServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    proxyToken = randomBytes(24).toString('hex')
    server = createServer(handleRequest)

    server.on('error', (err) => {
      console.error('[Proxy] Server error:', err)
      reject(err)
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      if (addr && typeof addr === 'object') {
        proxyPort = addr.port
        console.log(`[Proxy] HLS proxy server listening on http://127.0.0.1:${proxyPort}`)
        resolve(proxyPort)
      }
    })
  })
}

export function stopProxyServer(): void {
  cleanupExtractorWindow()
  if (server) {
    server.close()
    server = null
  }
}

// ─── Request handler ──────────────────────────────────────────

/**
 * Fetch through the extractor session and hand back the live Response.
 *
 * This used to await response.arrayBuffer() before returning, so a multi-MB
 * segment had to download completely — and be copied into a Node Buffer —
 * before hls.js saw its first byte. Returning the Response lets the caller
 * stream it straight through. Playlists still get read whole, because they
 * have to be rewritten, but they are kilobytes.
 */
async function sessionFetch(
  win: BrowserWindow,
  targetUrl: string,
  range: string | undefined,
  retries = 3
): Promise<Response> {
  const ses = win.webContents.session
  const headers: Record<string, string> = {}
  // Forward Range so seeking asks for the bytes it needs instead of the file.
  if (range) headers.Range = range

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // net.fetch() with the extractor session goes through Chromium's full
      // network stack, carrying the session's cookies and TLS state.
      // Don't set Referer/Origin as they may trigger ERR_BLOCKED_BY_CLIENT
      // when Electron's referrer-policy enforcement kicks in.
      const response = await net.fetch(targetUrl, {
        session: ses,
        bypassCustomProtocolHandlers: true,
        headers
      })

      if (response.status === 403 && attempt < retries) {
        // Release the socket before retrying, or the body leaks.
        await response.body?.cancel().catch(() => {})
        await new Promise((r) => setTimeout(r, 300 * attempt))
        continue
      }

      return response
    } catch (err) {
      const msg = (err as Error).message || String(err)
      console.error(`[Proxy] net.fetch error (attempt ${attempt}): ${msg}`)
      if (attempt >= retries) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
  throw new Error('Max retries exceeded')
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (!req.url || req.method !== 'GET') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const parsed = new URL(req.url, `http://127.0.0.1:${proxyPort}`)

  if (parsed.pathname !== '/proxy') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  if (!tokenMatches(parsed.searchParams.get('t'))) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  const targetUrl = parsed.searchParams.get('url')
  if (!targetUrl) {
    res.writeHead(400)
    res.end('Missing url parameter')
    return
  }

  if (!isSafeTarget(targetUrl)) {
    console.warn(`[Proxy] Refused non-remote target: ${targetUrl.substring(0, 80)}`)
    res.writeHead(400)
    res.end('Unsupported target')
    return
  }

  const win = getExtractorWindow()
  if (!win) {
    console.error('[Proxy] No extractor window available')
    res.writeHead(503)
    res.end('No browser context available')
    return
  }

  sessionFetch(win, targetUrl, req.headers.range)
    .then(async (response) => {
      const contentType = response.headers.get('content-type') || ''
      const status = response.status
      const isM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        targetUrl.includes('.m3u8')

      const outHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }

      if (isM3u8) {
        // Small, and every URL inside has to be rewritten to come back
        // through this proxy — so this one genuinely needs the whole body.
        const text = await response.text()
        if (status === 200 && text.trimStart().startsWith('#EXTM3U')) {
          outHeaders['Content-Type'] = 'application/vnd.apple.mpegurl'
          outHeaders['Cache-Control'] = 'no-cache' // live playlists change
          res.writeHead(200, outHeaders)
          res.end(rewritePlaylist(text, targetUrl))
        } else {
          console.warn(`[Proxy] Playlist URL returned non-m3u8 (starts: ${text.substring(0, 50)})`)
          res.writeHead(502)
          res.end('Invalid playlist content')
        }
        return
      }

      // Segments and keys: pipe straight through, no buffering.
      if (contentType) outHeaders['Content-Type'] = contentType

      // Deliberately NOT forwarding content-length. net.fetch decompresses the
      // body transparently, but that header still describes the *compressed*
      // size — advertising it against decompressed bytes truncates every
      // segment, which hls.js sees as a media error, "recovers" from, and hits
      // again on the next segment: an endless play/pause flip. Omitting it
      // lets Node use chunked encoding, which is correct either way.
      for (const h of ['content-range', 'accept-ranges']) {
        const v = response.headers.get(h)
        if (v) outHeaders[h] = v
      }
      // Segment URLs are effectively immutable, so letting the player keep
      // them makes seeking backwards instant instead of a re-download.
      outHeaders['Cache-Control'] = 'private, max-age=600'

      res.writeHead(status, outHeaders)

      if (!response.body) {
        res.end()
        return
      }

      const stream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
      // If the player seeks or switches level mid-segment, drop the upstream
      // read rather than leaving a socket draining into a dead response.
      res.on('close', () => stream.destroy())
      stream.on('error', () => res.destroy())
      stream.pipe(res)
    })
    .catch((err: Error) => {
      console.error(`[Proxy] Fetch error for ${targetUrl.substring(0, 80)}: ${err.message}`)
      if (!res.headersSent) res.writeHead(502)
      res.end(`Proxy fetch failed: ${err.message}`)
    })
}

// ─── Playlist rewriting ───────────────────────────────────────

function rewritePlaylist(content: string, playlistUrl: string): string {
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()

      if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
        return line
      }

      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/, (_match, uri: string) => {
          const absoluteUri = resolveUrl(uri, baseUrl)
          return `URI="${toProxyUrl(absoluteUri)}"`
        })
      }

      if (!trimmed.startsWith('#')) {
        const absoluteUrl = resolveUrl(trimmed, baseUrl)
        return toProxyUrl(absoluteUrl)
      }

      return line
    })
    .join('\n')
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  try {
    return new URL(url, baseUrl).href
  } catch {
    return baseUrl + url
  }
}
