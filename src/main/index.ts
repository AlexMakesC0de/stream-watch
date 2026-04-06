import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import {
  initDatabase,
  closeDatabase,
  addAnime,
  getLibrary,
  getAnime,
  updateStatus,
  removeAnime,
  saveProgress,
  getProgress,
  getEpisodeProgress,
  getContinueWatching,
  clearProviderMapping,
  toggleEpisodeCompleted,
  markAllEpisodesCompleted,
  addMedia,
  getMediaLibrary,
  getMedia,
  updateMediaStatus,
  removeMedia,
  saveMediaProgress,
  getMediaProgress,
  getMediaEpisodeProgress,
  getMediaContinueWatching,
  toggleMediaEpisodeCompleted,
  getSetting,
  setSetting,
  getAllSettings,
  resetSettings
} from './database'
import { fetchEpisodeSources, type FetchEpisodeOpts } from './providers'
import { startProxyServer, stopProxyServer } from './proxy'

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: '#111214',
    // macOS: use native hidden title bar; Linux/Windows: completely frameless
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : { frame: false }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: false, // needed for loading external anime images
      webviewTag: true // needed for embedded video player
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Track maximize state changes from OS-level events (e.g. double-click title bar, snap)
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ─── Auto Updater ────────────────────────────────────────────────

function setupAutoUpdater(): void {
  // Don't auto-install — let the user decide
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:update-available', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:update-downloaded', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  autoUpdater.checkForUpdates()
}

// ─── IPC Handlers ────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('db:add-anime', (_event, anime) => addAnime(anime))
  ipcMain.handle('db:get-library', (_event, status?: string) => getLibrary(status))
  ipcMain.handle('db:get-anime', (_event, anilistId: number) => getAnime(anilistId))
  ipcMain.handle('db:update-status', (_event, anilistId: number, status: string) =>
    updateStatus(anilistId, status)
  )
  ipcMain.handle('db:remove-anime', (_event, anilistId: number) => removeAnime(anilistId))
  ipcMain.handle('db:save-progress', (_event, progress) => saveProgress(progress))
  ipcMain.handle('db:get-progress', (_event, anilistId: number) => getProgress(anilistId))
  ipcMain.handle('db:get-episode-progress', (_event, anilistId: number, episodeNumber: number) =>
    getEpisodeProgress(anilistId, episodeNumber)
  )
  ipcMain.handle('db:get-continue-watching', () => getContinueWatching())
  ipcMain.handle('db:toggle-episode-completed', (_event, anilistId: number, episodeNumber: number, completed: boolean) =>
    toggleEpisodeCompleted(anilistId, episodeNumber, completed)
  )
  ipcMain.handle('db:mark-all-completed', (_event, anilistId: number, totalEpisodes: number) =>
    markAllEpisodesCompleted(anilistId, totalEpisodes)
  )

  // ── Streaming Provider ────────────────────────────────────────
  ipcMain.handle('provider:fetch-sources', async (_event, opts: FetchEpisodeOpts) => {
    const result = await fetchEpisodeSources(opts)
    return result
  })
  ipcMain.handle('provider:clear-cache', (_event, anilistId: number) =>
    clearProviderMapping(anilistId)
  )

  // ── Media (Movies & TV) ──────────────────────────────────────
  ipcMain.handle('db:add-media', (_event, media) => addMedia(media))
  ipcMain.handle('db:get-media-library', (_event, status?: string) => getMediaLibrary(status))
  ipcMain.handle('db:get-media', (_event, tmdbId: number, mediaType: string) =>
    getMedia(tmdbId, mediaType)
  )
  ipcMain.handle('db:update-media-status', (_event, tmdbId: number, mediaType: string, status: string) =>
    updateMediaStatus(tmdbId, mediaType, status)
  )
  ipcMain.handle('db:remove-media', (_event, tmdbId: number, mediaType: string) =>
    removeMedia(tmdbId, mediaType)
  )
  ipcMain.handle('db:save-media-progress', (_event, progress) => saveMediaProgress(progress))
  ipcMain.handle('db:get-media-progress', (_event, tmdbId: number, mediaType: string) =>
    getMediaProgress(tmdbId, mediaType)
  )
  ipcMain.handle(
    'db:get-media-episode-progress',
    (_event, tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null) =>
      getMediaEpisodeProgress(tmdbId, mediaType, seasonNumber, episodeNumber)
  )
  ipcMain.handle('db:get-media-continue-watching', () => getMediaContinueWatching())
  ipcMain.handle(
    'db:toggle-media-episode-completed',
    (_event, tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null, completed: boolean) =>
      toggleMediaEpisodeCompleted(tmdbId, mediaType, seasonNumber, episodeNumber, completed)
  )

  // ── Window controls ──────────────────────────────────────────
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    // Notify renderer of new state
    win.webContents.send('window:maximized-changed', win.isMaximized())
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('window:is-maximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
  ipcMain.handle('app:get-version', () => app.getVersion())

  // ── Auto Updater ──────────────────────────────────────────
  ipcMain.on('updater:restart', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // ── Settings ──────────────────────────────────────────────
  ipcMain.handle('settings:get', (_event, key: string) => getSetting(key))
  ipcMain.handle('settings:set', (_event, key: string, value: string) => setSetting(key, value))
  ipcMain.handle('settings:get-all', () => getAllSettings())
  ipcMain.handle('settings:reset', () => resetSettings())
}

// ─── App Lifecycle ─────────────────────────────────────────────

// Allow autoplay in webviews (episode player)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// ─── Ad/popup blocker for the embed player webview ─────────────

function setupEmbedSessionAdBlocker(): void {
  const ses = session.fromPartition('persist:extractor')

  // Comprehensive list of ad/tracking/popup domains
  const blockedDomains = [
    // Google ads & tracking
    'googletagmanager.com',
    'google-analytics.com',
    'googleadservices.com',
    'googlesyndication.com',
    'doubleclick.net',
    'adservice.google.com',
    // Common ad networks
    'popads.net',
    'popcash.net',
    'popunder.net',
    'pop.liveonlinetv247.info',
    'adb.placementapi.com',
    'ad.plus',
    'adnxs.com',
    'adskeeper.co.uk',
    'adskeeper.com',
    'adsterra.com',
    'adsterracdn.com',
    'bidswitch.net',
    'bongacams.com',
    'bounceexchange.com',
    'bvtpk.com',
    'casalemedia.com',
    'cdnads.com',
    'chaturbate.com',
    'cpx.to',
    'criteo.com',
    'dataunlocker.com',
    'doublepimp.com',
    'exoclick.com',
    'exosrv.com',
    'hilltopads.net',
    'imedia.com',
    'juicyads.com',
    'livestream247.tv',
    'liveonlinetv247.info',
    'markerapp.net',
    'mixedinkey.com',
    'offerforge.com',
    'outbrain.com',
    'perf-serving.com',
    'plausible.io',
    'plerdy.com',
    'propellerads.com',
    'pushame.com',
    'pushnami.com',
    'richpush.co',
    'rubiconproject.com',
    'seedtag.com',
    'serving-sys.com',
    'smartadserver.com',
    'syndication.exdynsrv.com',
    'taboola.com',
    'trafficfactory.biz',
    'trafficjunky.net',
    'tsyndicate.com',
    'vidazoo.com',
    'videovard.to',
    'viglink.com',
    'volatiledeals.com',
    'zedo.com',
    'zemanta.com',
    // VidSrc-specific ad domains
    'dfrsgbn.com',
    'fgttehnh.com',
    'nmhdkhb.com',
    'tcfrhnbgf.com',
    'wsresgnh.com',
    'nxtrvlb.com',
    // Additional embed ad networks
    'a-ads.com',
    'ad-maven.com',
    'ad4m.at',
    'adcash.com',
    'adhealers.com',
    'adition.com',
    'admaven.com',
    'adtng.com',
    'betterads.io',
    'cdn77.org/ads',
    'coinzillatag.com',
    'disqus.com',
    'etahub.com',
    'flashtalking.com',
    'gammaplatform.com',
    'go.oclasrv.com',
    'go.stratos-ad.com',
    'imasdk.googleapis.com',
    'mfadsrvr.com',
    'mgid.com',
    'mopub.com',
    'onclickmax.com',
    'onclickmega.com',
    'onclickperformance.com',
    'revcontent.com',
    'revdepo.com',
    'richads.com',
    's2s.popcash.net',
    'servehttp.com',
    'sharedcount.com',
    'srvtrck.com',
    'streamhub.to',
    'tpc.googlesyndication.com',
    'vemtoutcherede.com',
    'whos.amung.us',
    'ylx-aff.com',
    // NSFW ad networks
    'magsrv.com',
    'a.magsrv.com',
    'realsrv.com',
    'syndication.realsrv.com',
    'jads.co',
    'clickadilla.com',
    'clickaine.com',
    'hilltopads.com',
    'clickstar.me',
    'pushground.com',
    'img.trafficjunky.net',
    'ads.trafficjunky.net',
    'rayrfrh.com',
    'acwebconnecting.com',
    'mtrgt.com',
    'ahrtv.com',
    'tsyndicate.com',
    'a.realsrv.com',
    'mc.yandex.ru',
    'aweptjmp.com',
    'acscdn.com',
    'adsco.re',
    'dfrsgbn.com',
    'dolohen.com',
    'exdynsrv.com',
    'hpyrdr.com',
    'jokfrr.com',
    'kefrfrh.com',
    'lnkrdr.com',
    'mxtrck.com',
    'nptfr.com',
    'optmnstr.com',
    'ptrckpm.com',
    'rfihub.com',
    'rtmark.net',
    'slfrdr.com',
    'streamdefence.com',
    'tfyctrl.com',
    't.co/redirect',
    'voourl.com',
    'xtremepush.com',
    // NSFW site domains (to block redirects to them)
    'pornhub.com',
    'xhamster.com',
    'xvideos.com',
    'stripchat.com',
    'livejasmin.com',
    'cam4.com',
    'myfreecams.com',
    'istripper.com',
    'camsoda.com',
    'nuvid.com',
    'tubecorp.com',
    'chaturbate.com',
    'bongacams.com',
    'onlyfans.com'
  ]

  // Block requests to ad domains
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.toLowerCase()

    // Block known ad domains
    if (blockedDomains.some((d) => url.includes(d))) {
      callback({ cancel: true })
      return
    }

    // Block common ad URL patterns
    if (
      (url.includes('/pop') && (url.includes('.js') || url.includes('under'))) ||
      url.includes('/ads/') ||
      url.includes('/ads?') ||
      url.includes('/adserv') ||
      url.includes('pagead') ||
      url.includes('prebid') ||
      url.includes('/vast/') ||
      url.includes('/vast?') ||
      url.includes('/vpaid') ||
      url.includes('clickunder') ||
      url.includes('popunder') ||
      url.includes('popcash') ||
      url.includes('clickadu') ||
      url.includes('xxx') ||
      url.includes('porn') ||
      url.includes('adult') ||
      url.includes('sex.com') ||
      url.includes('dating') ||
      url.includes('cam4.com') ||
      url.includes('stripchat') ||
      url.includes('livejasmin') ||
      url.includes('istripper')
    ) {
      callback({ cancel: true })
      return
    }

    callback({})
  })

  // Strip CSP headers that could interfere and block X-Frame-Options
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders }
    for (const key of Object.keys(headers)) {
      const lk = key.toLowerCase()
      if (
        lk.startsWith('content-security-policy') ||
        lk === 'x-frame-options' ||
        lk === 'referrer-policy'
      ) {
        delete headers[key]
      }
    }
    callback({ responseHeaders: headers })
  })

  // Block popup windows (the primary ad delivery mechanism)
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // Block if this is a navigation to a different origin from a popup
    if (details.resourceType === 'subFrame') {
      const url = details.url.toLowerCase()
      if (blockedDomains.some((d) => url.includes(d))) {
        callback({ cancel: true })
        return
      }
    }
    callback({ requestHeaders: details.requestHeaders })
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.streamwatch.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Block popup windows from webview contents (embed player ads)
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(() => {
        return { action: 'deny' }
      })

      // Block ad/NSFW redirects via window.location, meta refresh, etc.
      const adNavigationPatterns = [
        'porn', 'xxx', 'adult', 'sex.com', 'dating',
        'magsrv', 'realsrv', 'clickadilla', 'jads.co',
        'popads', 'popcash', 'adsterra', 'exoclick',
        'trafficjunky', 'propellerads', 'hilltopads', 'pushground',
        'chaturbate', 'bongacams', 'stripchat', 'livejasmin',
        'cam4.com', 'istripper', 'onlyfans', 'dolohen',
        'exdynsrv', 'adsco.re', 'aweptjmp', 'ahrtv'
      ]

      const isAdUrl = (url: string): boolean => {
        const lower = url.toLowerCase()
        return adNavigationPatterns.some((p) => lower.includes(p))
      }

      contents.on('will-navigate', (event, url) => {
        if (isAdUrl(url)) event.preventDefault()
      })

      contents.on('will-redirect', (event, url) => {
        if (isAdUrl(url)) event.preventDefault()
      })
    }
  })

  await initDatabase()
  await startProxyServer()
  registerIpcHandlers()
  setupEmbedSessionAdBlocker()
  createWindow()
  
  // Check for updates after window is ready (production only)
  if (!is.dev) {
    setupAutoUpdater()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  stopProxyServer()
  closeDatabase()
})
