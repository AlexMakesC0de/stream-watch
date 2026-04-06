import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API exposed to renderer
const api = {
  // ── Library ────────────────────────────────────
  addAnime: (anime: Record<string, unknown>) => ipcRenderer.invoke('db:add-anime', anime),
  getLibrary: (status?: string) => ipcRenderer.invoke('db:get-library', status),
  getAnime: (anilistId: number) => ipcRenderer.invoke('db:get-anime', anilistId),
  updateStatus: (anilistId: number, status: string) =>
    ipcRenderer.invoke('db:update-status', anilistId, status),
  removeAnime: (anilistId: number) => ipcRenderer.invoke('db:remove-anime', anilistId),

  // ── Watch Progress ─────────────────────────────
  saveProgress: (progress: Record<string, unknown>) =>
    ipcRenderer.invoke('db:save-progress', progress),
  getProgress: (anilistId: number) => ipcRenderer.invoke('db:get-progress', anilistId),
  getEpisodeProgress: (anilistId: number, episodeNumber: number) =>
    ipcRenderer.invoke('db:get-episode-progress', anilistId, episodeNumber),
  getContinueWatching: () => ipcRenderer.invoke('db:get-continue-watching'),
  toggleEpisodeCompleted: (anilistId: number, episodeNumber: number, completed: boolean) =>
    ipcRenderer.invoke('db:toggle-episode-completed', anilistId, episodeNumber, completed),
  markAllEpisodesCompleted: (anilistId: number, totalEpisodes: number) =>
    ipcRenderer.invoke('db:mark-all-completed', anilistId, totalEpisodes),

  // ── Streaming Provider ─────────────────────────
  fetchEpisodeSources: (opts: Record<string, unknown>) =>
    ipcRenderer.invoke('provider:fetch-sources', opts),
  clearProviderCache: (anilistId: number) =>
    ipcRenderer.invoke('provider:clear-cache', anilistId),

  // ── Media (Movies & TV) ────────────────────────
  addMedia: (media: Record<string, unknown>) => ipcRenderer.invoke('db:add-media', media),
  getMediaLibrary: (status?: string) => ipcRenderer.invoke('db:get-media-library', status),
  getMedia: (tmdbId: number, mediaType: string) =>
    ipcRenderer.invoke('db:get-media', tmdbId, mediaType),
  updateMediaStatus: (tmdbId: number, mediaType: string, status: string) =>
    ipcRenderer.invoke('db:update-media-status', tmdbId, mediaType, status),
  removeMedia: (tmdbId: number, mediaType: string) =>
    ipcRenderer.invoke('db:remove-media', tmdbId, mediaType),
  saveMediaProgress: (progress: Record<string, unknown>) =>
    ipcRenderer.invoke('db:save-media-progress', progress),
  getMediaProgress: (tmdbId: number, mediaType: string) =>
    ipcRenderer.invoke('db:get-media-progress', tmdbId, mediaType),
  getMediaEpisodeProgress: (tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null) =>
    ipcRenderer.invoke('db:get-media-episode-progress', tmdbId, mediaType, seasonNumber, episodeNumber),
  getMediaContinueWatching: () => ipcRenderer.invoke('db:get-media-continue-watching'),
  toggleMediaEpisodeCompleted: (tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null, completed: boolean) =>
    ipcRenderer.invoke('db:toggle-media-episode-completed', tmdbId, mediaType, seasonNumber, episodeNumber, completed),

  // ── Window Controls ────────────────────────────
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChanged: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean): void => callback(maximized)
    ipcRenderer.on('window:maximized-changed', handler)
    return () => ipcRenderer.removeListener('window:maximized-changed', handler)
  },
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),


  // ── Settings ───────────────────────────────────
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  // ── Auto Updater ───────────────────────────────
  onUpdateAvailable: (callback: (version: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, version: string): void => callback(version)
    ipcRenderer.on('updater:update-available', handler)
    return () => ipcRenderer.removeListener('updater:update-available', handler)
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, version: string): void => callback(version)
    ipcRenderer.on('updater:update-downloaded', handler)
    return () => ipcRenderer.removeListener('updater:update-downloaded', handler)
  },
  restartToUpdate: () => ipcRenderer.send('updater:restart')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
