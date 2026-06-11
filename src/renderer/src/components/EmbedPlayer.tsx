import { useRef, useEffect, useCallback, useState } from 'react'

interface EmbedPlayerProps {
  src: string
  title?: string
  episodeNumber?: number
  initialTime?: number
  fullscreenTarget?: React.RefObject<HTMLElement | null>
  disableInteractions?: boolean
  onProgress?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  onError?: (message: string) => void
  onLoadError?: (info: { code: number; description: string; url: string }) => void
}

/**
 * Embeds the streaming player page in a <webview> with the extractor session.
 * The browser's native network stack handles Cloudflare, HLS, etc.
 * We inject JS to track progress and CSS to clean up the player UI.
 */
export default function EmbedPlayer({
  src,
  title,
  episodeNumber,
  initialTime = 0,
  fullscreenTarget,
  disableInteractions = false,
  onProgress,
  onEnded,
  onLoadError
}: EmbedPlayerProps): JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const lastReportedRef = useRef(0)
  const endedFiredRef = useRef(false)
  // Ensures we only report a load failure once per source (mount)
  const loadErrorFiredRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)

  // Report a load failure exactly once, so the parent can move to another source
  const reportLoadError = useCallback(
    (info: { code: number; description: string; url: string }) => {
      if (loadErrorFiredRef.current) return
      loadErrorFiredRef.current = true
      console.warn(`[EmbedPlayer] Source unusable: ${info.description} (${info.url})`)
      onLoadError?.(info)
    },
    [onLoadError]
  )

  const dispatchAutoplayGesture = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return

    const bounds = webview.getBoundingClientRect()
    const x = Math.max(1, Math.floor(bounds.width / 2))
    const y = Math.max(1, Math.floor(bounds.height / 2))

    try {
      webview.focus()
      webview.sendInputEvent({ type: 'mouseMove', x, y })
      webview.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
      webview.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
      webview.sendInputEvent({ type: 'keyDown', keyCode: 'Space' })
      webview.sendInputEvent({ type: 'char', keyCode: ' ' })
      webview.sendInputEvent({ type: 'keyUp', keyCode: 'Space' })
    } catch {
      // ignore gesture injection failures
    }
  }, [])

  // Inject CSS and JS after the player page loads
  const onDomReady = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return
    setIsLoading(false)

    // Detect "loaded but broken" pages — Cloudflare/gateway errors, host-down
    // notices, etc. These return a real HTML document (so did-fail-load never
    // fires) but will never produce a player. Treat them as a failed source.
    webview
      .executeJavaScript(`
        (function() {
          var t = (document.title || '').toLowerCase();
          var b = (document.body ? document.body.innerText : '').toLowerCase().slice(0, 600);
          var hay = t + ' ' + b;
          var sigs = [
            'connection timed out', 'error code 5', 'error code 4',
            '520:', '521:', '522:', '523:', '524:',
            '502 bad gateway', '503 service', '504 gateway',
            'web server is down', 'host error', 'origin is unreachable',
            'this site can', 'dns_probe', 'err_name_not_resolved',
            'video not found', 'media not found', 'no sources found'
          ];
          for (var i = 0; i < sigs.length; i++) {
            if (hay.indexOf(sigs[i]) > -1) return sigs[i];
          }
          return '';
        })();
      `)
      .then((sig: string) => {
        if (sig) reportLoadError({ code: 0, description: 'Source error page: ' + sig, url: src })
      })
      .catch(() => {})

    // Block popups/new-windows from ads
    try {
      const wc = (webview as any).getWebContents?.()
      if (wc) {
        wc.setWindowOpenHandler(() => ({ action: 'deny' }))
      }
    } catch {
      // renderer may not have access — main process handler will cover it
    }

    // Inject CSS to clean up the player (hide ads, overlays, make video fill)
    webview.insertCSS(`
      body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #000 !important; }
      /* Hide known ad/overlay elements — keep selectors specific to avoid breaking the player */
      .ads, .ad-overlay, .ad-container,
      [id*="ad-container"], [id*="ad-overlay"],
      .jw-logo, .plyr__ads,
      div[style*="z-index: 2147483647"], div[style*="z-index:2147483647"],
      div[style*="z-index: 99999"], div[style*="z-index:99999"],
      div[style*="z-index: 9999"], div[style*="z-index:9999"],
      a[target="_blank"][style*="position"],
      .overlay-ad, #overlay-ad,
      iframe[src*="ads"], iframe[src*="banner"] { display: none !important; }
      /* Hide NSFW ad elements */
      a[href*="porn"], a[href*="xxx"], a[href*="adult"], a[href*="sex.com"],
      a[href*="dating"], a[href*="stripchat"], a[href*="livejasmin"], a[href*="cam4"],
      a[href*="chaturbate"], a[href*="bongacams"], a[href*="istripper"],
      a[href*="onlyfans"], a[href*="magsrv"], a[href*="realsrv"],
      a[href*="clickadilla"], a[href*="jads.co"],
      img[src*="magsrv"], img[src*="realsrv"],
      div[id*="exoclick"], div[id*="juicyads"],
      div[class*="exoclick"], div[class*="juicyads"] { display: none !important; }
      /* Prevent fullscreen ad overlays — but not the player itself */
      body > div[style*="position: fixed"]:not(:has(video)):not(:has(iframe)),
      body > div[style*="position:fixed"]:not(:has(video)):not(:has(iframe)) {
        display: none !important;
      }
      /* NOTE: deliberately do NOT force the player wrapper to position:fixed /
         100% size. Matching [class*="player"], .plyr, .video-js etc. and pinning
         them fullscreen rips the provider's control bar out of place and stacks a
         layer over the buttons, making pause/volume unclickable. Modern players
         already fill their own viewport, so leave their layout alone. */
    `).catch(() => {})

    // Inject popup/redirect blocker script
    webview.executeJavaScript(`
      (function() {
        // Block window.open (primary popup mechanism)
        window.open = function() { return null; };

        // Block ad scripts from being injected (but allow all other DOM operations)
        var origAppend = Element.prototype.appendChild;
        Element.prototype.appendChild = function(child) {
          if (child && child.tagName === 'SCRIPT' && child.src) {
            var src = child.src.toLowerCase();
            if (src.includes('popads') || src.includes('popcash') || src.includes('popunder') ||
                src.includes('adsterra') || src.includes('exoclick') || src.includes('propellerads') ||
                src.includes('trafficjunky') || src.includes('juicyads') || src.includes('admaven') ||
                src.includes('googlesyndication') || src.includes('doubleclick')) {
              return child;
            }
          }
          return origAppend.call(this, child);
        };
        var origInsert = Element.prototype.insertBefore;
        Element.prototype.insertBefore = function(child, ref) {
          if (child && child.tagName === 'SCRIPT' && child.src) {
            var src = child.src.toLowerCase();
            if (src.includes('popads') || src.includes('popcash') || src.includes('popunder') ||
                src.includes('adsterra') || src.includes('exoclick') || src.includes('propellerads') ||
                src.includes('trafficjunky') || src.includes('juicyads') || src.includes('admaven') ||
                src.includes('googlesyndication') || src.includes('doubleclick')) {
              return child;
            }
          }
          return origInsert.call(this, child, ref);
        };

        // Block onclick popups on document
        document.addEventListener('click', function(e) {
          var t = e.target;
          while (t && t !== document.body) {
            if (t.tagName === 'A' && t.target === '_blank') {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
            t = t.parentElement;
          }
        }, true);

        // Shared ad-removal patterns used by both MutationObserver and setInterval
        var nsfwPatterns = ['porn','xxx','adult','sex.com','dating','stripchat','livejasmin',
          'cam4','chaturbate','bongacams','istripper','onlyfans','magsrv','realsrv',
          'clickadilla','jads.co','exoclick','juicyads','trafficjunky','adsterra'];

        function isPlayerEl(el) {
          return el.querySelector('video') || el.querySelector('iframe') ||
            el.closest('.jw-wrapper') || el.closest('.video-js') || el.closest('.plyr');
        }

        function removeAdEl(el) {
          if (el && el.parentElement && !isPlayerEl(el)) el.remove();
        }

        function sweepAdOverlays() {
          // High z-index overlays without video/iframe are almost always ads
          document.querySelectorAll(
            'div[style*="z-index: 2147483647"], div[style*="z-index:2147483647"], ' +
            'div[style*="z-index: 99999"], div[style*="z-index:99999"], ' +
            'div[style*="z-index: 9999"], div[style*="z-index:9999"]'
          ).forEach(function(el) { removeAdEl(el); });

          // Remove NSFW anchor elements and empty wrappers
          document.querySelectorAll('a[href]').forEach(function(a) {
            var href = a.href.toLowerCase();
            for (var i = 0; i < nsfwPatterns.length; i++) {
              if (href.includes(nsfwPatterns[i])) {
                var parent = a.parentElement;
                a.remove();
                if (parent && !parent.querySelector('video') && !parent.querySelector('iframe') && parent.children.length === 0) {
                  parent.remove();
                }
                break;
              }
            }
          });
        }

        // MutationObserver: removes ad nodes the instant they're injected into the DOM
        try {
          var adObserver = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
              var added = mutations[i].addedNodes;
              for (var j = 0; j < added.length; j++) {
                var node = added[j];
                if (node.nodeType !== 1) continue;
                var style = node.getAttribute ? node.getAttribute('style') || '' : '';
                var zMatch = style.match(/z-index\s*:\s*(\d+)/);
                if (zMatch && parseInt(zMatch[1], 10) >= 9999 && !isPlayerEl(node)) {
                  node.remove();
                  continue;
                }
                var href = (node.tagName === 'A' && node.href) ? node.href.toLowerCase() : '';
                if (href) {
                  for (var k = 0; k < nsfwPatterns.length; k++) {
                    if (href.includes(nsfwPatterns[k])) { node.remove(); break; }
                  }
                }
              }
            }
          });
          adObserver.observe(document.documentElement, { childList: true, subtree: true });
        } catch(e) {}

        // Fallback sweep every 2s for anything that slipped through
        setInterval(sweepAdOverlays, 2000);
      })();
    `).catch(() => {})

    // Inject JS to report progress and seek to initial time
    const initScript = `
      (function() {
        let reported = false;
        let iframePatched = false;
        function findVideo() {
          const videos = document.querySelectorAll('video');
          // Also check iframes
          if (videos.length === 0) {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              try {
                const iframeVideos = iframe.contentDocument?.querySelectorAll('video');
                if (iframeVideos && iframeVideos.length > 0) return iframeVideos[0];
              } catch(e) { /* cross-origin */ }
            }
            return null;
          }
          return videos[0];
        }

        function patchIframeAutoplay() {
          if (iframePatched) return;
          const iframes = document.querySelectorAll('iframe[src]');
          if (!iframes.length) return;
          iframes.forEach(function(iframe) {
            try {
              const src = iframe.getAttribute('src');
              if (!src) return;
              const u = new URL(src, location.href);
              u.searchParams.set('autoplay', '1');
              u.searchParams.set('autoPlay', '1');
              // NOTE: do NOT force mute here — autoplay-policy is set to
              // 'no-user-gesture-required' app-wide, so sound is allowed. Forcing
              // mute=1 on cross-origin iframe players left them permanently silent.
              const next = u.toString();
              if (next !== src) iframe.setAttribute('src', next);
            } catch(e) {}
          });
          iframePatched = true;
        }

        // Poll for video element and keep retrying play until it works
        let playing = false;
        const checkInterval = setInterval(() => {
          if (playing) { clearInterval(checkInterval); return; }

          patchIframeAutoplay();

          // Also try clicking any play button overlays the player might have
          const playBtns = document.querySelectorAll(
            '.jw-icon-playback, .vjs-big-play-button, .plyr__control--overlaid, ' +
            'button[aria-label="Play"], [class*="play-button"], [class*="play_button"], ' +
            '[class*="playBtn"], .btn-play, #play-btn'
          );
          playBtns.forEach(function(btn) { btn.click(); });

          const video = findVideo();
          if (!video) return;

          // Set initial time or nudge to 0.1s to trigger loading
          if (${initialTime} > 0 && !reported) {
            video.currentTime = ${initialTime};
          } else if (!reported) {
            video.currentTime = 0.1;
          }
          reported = true;

          // Try to play WITH sound first (allowed by the autoplay policy). Only
          // if that's rejected do we fall back to muted playback, then restore
          // sound shortly after — otherwise streams stay silent forever.
          var p = video.play();
          if (p && p.then) {
            p.then(function() { playing = true; }).catch(function() {
              video.muted = true;
              video.play().then(function() {
                playing = true;
                setTimeout(function() { try { video.muted = false; } catch (e) {} }, 500);
              }).catch(function() {});
            });
          }

          // Also dispatch a click on the video in case the player needs it
          video.click();
        }, 500);

        // Clean up after 30 seconds
        setTimeout(() => clearInterval(checkInterval), 30000);
      })();
    `
    webview.executeJavaScript(initScript).catch(() => {})
  }, [initialTime, reportLoadError, src])

  // Start progress polling
  useEffect(() => {
    if (isLoading) return

    const webview = webviewRef.current
    if (!webview) return

    progressIntervalRef.current = window.setInterval(() => {
      webview
        .executeJavaScript(`
          (function() {
            const videos = document.querySelectorAll('video');
            const video = videos[0];
            if (!video) return null;
            return {
              currentTime: video.currentTime,
              duration: video.duration || 0,
              ended: video.ended,
              paused: video.paused
            };
          })();
        `)
        .then((state: { currentTime: number; duration: number; ended: boolean; paused: boolean } | null) => {
          if (!state) return
          if (
            state.currentTime > 0 &&
            state.duration > 0 &&
            Math.abs(state.currentTime - lastReportedRef.current) >= 5
          ) {
            lastReportedRef.current = state.currentTime
            onProgress?.(state.currentTime, state.duration)
          }
          // Detect episode end: video.ended, OR watched past 85% of duration
          const isNearEnd = state.duration > 0 && state.currentTime / state.duration > 0.85
          if ((state.ended || isNearEnd) && !endedFiredRef.current) {
            endedFiredRef.current = true
            // Report final progress so it's marked completed
            if (state.duration > 0) {
              onProgress?.(state.currentTime, state.duration)
            }
            onEnded?.()
          }
        })
        .catch(() => {})
    }, 2000)

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [isLoading, onProgress, onEnded])

  // Health check: if the page loads but never produces a <video> or player
  // iframe within a grace period, the source is effectively dead — report it
  // so the parent can fall through to another provider.
  useEffect(() => {
    if (isLoading) return
    const webview = webviewRef.current
    if (!webview) return

    let elapsed = 0
    const STEP = 2000
    const GRACE_MS = 14000
    const timer = window.setInterval(() => {
      elapsed += STEP
      webview
        .executeJavaScript(`
          (function() {
            var t = (document.title || '').toLowerCase();
            var b = (document.body ? document.body.innerText : '').toLowerCase().slice(0, 900);
            var hay = t + ' ' + b;
            // Provider's own "can't serve this" notices — these appear a few
            // seconds in, after the player tries (and fails) to find a stream.
            var errs = [
              'no sources found', 'no source found', 'source not found',
              'no streams', 'no stream found', 'no playable',
              'not available in your', 'not available in this',
              'media not found', 'video not found', 'content not found'
            ];
            for (var i = 0; i < errs.length; i++) {
              if (hay.indexOf(errs[i]) > -1) return 'ERR:' + errs[i];
            }
            if (document.querySelector('video')) return 'PLAYER';
            var f = document.querySelector('iframe[src]');
            if (f && f.src && f.src.indexOf('about:blank') === -1) return 'PLAYER';
            return '';
          })();
        `)
        .then((res: string) => {
          if (res === 'PLAYER') {
            window.clearInterval(timer)
            return
          }
          if (res.indexOf('ERR:') === 0) {
            window.clearInterval(timer)
            reportLoadError({ code: 0, description: 'Source: ' + res.slice(4), url: src })
            return
          }
          if (elapsed >= GRACE_MS) {
            window.clearInterval(timer)
            reportLoadError({
              code: 0,
              description: 'No player appeared (source likely unavailable)',
              url: src
            })
          }
        })
        .catch(() => {})
    }, STEP)

    return () => window.clearInterval(timer)
  }, [isLoading, reportLoadError, src])

  // Handle webview fullscreen requests (e.g. user clicks fullscreen button inside the video)
  useEffect(() => {
    const webview = webviewRef.current
    const container = containerRef.current
    if (!webview || !container) return

    const handleEnterFS = (): void => {
      const target = fullscreenTarget?.current || container
      if (!document.fullscreenElement && target) {
        target.requestFullscreen().catch(() => {})
      }
    }
    const handleLeaveFS = (): void => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }

    webview.addEventListener('enter-html-full-screen', handleEnterFS)
    webview.addEventListener('leave-html-full-screen', handleLeaveFS)

    // Block popup windows (ad clicks that try to open new windows)
    const handleNewWindow = (e: Event): void => {
      e.preventDefault()
    }
    webview.addEventListener('new-window', handleNewWindow)

    return () => {
      webview.removeEventListener('enter-html-full-screen', handleEnterFS)
      webview.removeEventListener('leave-html-full-screen', handleLeaveFS)
      webview.removeEventListener('new-window', handleNewWindow)
    }
  }, [])

  // Handle webview errors
  const onDidFailLoad = useCallback(
    (_e: Event) => {
      const ev = _e as unknown as {
        errorCode: number
        errorDescription: string
        validatedURL: string
        isMainFrame: boolean
      }
      // Ignore user-aborted loads (-3), which fire whenever we switch sources
      if (ev.errorCode === -3 || ev.errorDescription === 'ERR_ABORTED') return

      // A main-frame failure means the provider page itself didn't load
      // (dead domain, DNS failure, blocked, etc.) — surface it so the caller
      // can move on to another source instead of showing a black screen.
      if (ev.isMainFrame) {
        reportLoadError({
          code: ev.errorCode,
          description: ev.errorDescription,
          url: ev.validatedURL
        })
      } else {
        // Sub-resource (often an ad/iframe) failed — non-fatal
        console.warn(`[EmbedPlayer] Sub-resource failed: ${ev.errorDescription}`)
      }
    },
    [reportLoadError]
  )

  // Set up webview event listeners
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-fail-load', onDidFailLoad)

    return () => {
      webview.removeEventListener('dom-ready', onDomReady)
      webview.removeEventListener('did-fail-load', onDidFailLoad)
    }
  }, [onDomReady, onDidFailLoad])

  // ─── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (!webview) return
      // Don't handle if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          webview.executeJavaScript(`
            (function() {
              const v = document.querySelector('video');
              if (!v) return;
              v.paused ? v.play() : v.pause();
            })();
          `).catch(() => {})
          break
        case 'ArrowLeft':
          e.preventDefault()
          webview.executeJavaScript(`
            (function() {
              const v = document.querySelector('video');
              if (v) v.currentTime = Math.max(0, v.currentTime - 10);
            })();
          `).catch(() => {})
          break
        case 'ArrowRight':
          e.preventDefault()
          webview.executeJavaScript(`
            (function() {
              const v = document.querySelector('video');
              if (v) v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
            })();
          `).catch(() => {})
          break
        case 'ArrowUp':
          e.preventDefault()
          webview.executeJavaScript(`
            (function() {
              const v = document.querySelector('video');
              if (v) v.volume = Math.min(1, v.volume + 0.1);
            })();
          `).catch(() => {})
          break
        case 'ArrowDown':
          e.preventDefault()
          webview.executeJavaScript(`
            (function() {
              const v = document.querySelector('video');
              if (v) v.volume = Math.max(0, v.volume - 0.1);
            })();
          `).catch(() => {})
          break
        case 'f':
        case 'F': {
          e.preventDefault()
          const target = fullscreenTarget?.current || containerRef.current
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          } else if (target) {
            target.requestFullscreen().catch(() => {})
          }
          break
        }
        case 'm':
        case 'M':
          e.preventDefault()
          webview.executeJavaScript(`
            (function() {
              const v = document.querySelector('video');
              if (v) v.muted = !v.muted;
            })();
          `).catch(() => {})
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenTarget])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    let attemptCount = 0
    const maxAttempts = 8

    const runAttempt = (): void => {
      if (attemptCount >= maxAttempts) return
      attemptCount += 1

      dispatchAutoplayGesture()

      webview.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (!video) return false;
          if (video.paused) {
            try {
              if (video.currentTime < 0.1) video.currentTime = 0.1;
              video.play();
            } catch {}
          }
          return !video.paused;
        })();
      `).then((isPlaying: boolean) => {
        if (!isPlaying && attemptCount < maxAttempts) {
          window.setTimeout(runAttempt, 700)
        }
      }).catch(() => {
        if (attemptCount < maxAttempts) {
          window.setTimeout(runAttempt, 700)
        }
      })
    }

    const timeoutId = window.setTimeout(runAttempt, 900)
    return () => window.clearTimeout(timeoutId)
  }, [src, dispatchAutoplayGesture])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
            <p className="text-sm text-gray-400">Loading player...</p>
          </div>
        </div>
      )}

      {/* WebView — uses the extractor session which has Cloudflare clearance */}
      <webview
        ref={webviewRef as React.RefObject<Electron.WebviewTag>}
        src={src}
        partition="persist:extractor"
        style={{ width: '100%', height: '100%', border: 'none', pointerEvents: disableInteractions ? 'none' : 'auto' }}
        allowpopups={'false' as unknown as boolean}
        // @ts-ignore - webview attributes
        disablewebsecurity="true"
        allowFullScreen
        // @ts-ignore
        webpreferences="autoplay=true"
      />
    </div>
  )
}
