import { ElectronAPI } from '@electron-toolkit/preload'

interface AnimeWatchAPI {
  addAnime: (anime: Record<string, unknown>) => Promise<unknown>
  getLibrary: (status?: string) => Promise<unknown[]>
  getAnime: (anilistId: number) => Promise<unknown>
  updateStatus: (anilistId: number, status: string) => Promise<unknown>
  removeAnime: (anilistId: number) => Promise<unknown>
  saveProgress: (progress: Record<string, unknown>) => Promise<unknown>
  getProgress: (anilistId: number) => Promise<unknown[]>
  getEpisodeProgress: (anilistId: number, episodeNumber: number) => Promise<unknown>
  getContinueWatching: () => Promise<unknown[]>
  toggleEpisodeCompleted: (anilistId: number, episodeNumber: number, completed: boolean) => Promise<unknown>
  markAllEpisodesCompleted: (anilistId: number, totalEpisodes: number) => Promise<unknown>
  fetchEpisodeSources: (opts: Record<string, unknown>) => Promise<unknown>
  clearProviderCache: (anilistId: number) => Promise<unknown>

  // Media (Movies & TV)
  addMedia: (media: Record<string, unknown>) => Promise<unknown>
  getMediaLibrary: (status?: string) => Promise<unknown[]>
  getMedia: (tmdbId: number, mediaType: string) => Promise<unknown>
  updateMediaStatus: (tmdbId: number, mediaType: string, status: string) => Promise<unknown>
  removeMedia: (tmdbId: number, mediaType: string) => Promise<unknown>
  saveMediaProgress: (progress: Record<string, unknown>) => Promise<unknown>
  getMediaProgress: (tmdbId: number, mediaType: string) => Promise<unknown[]>
  getMediaEpisodeProgress: (tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null) => Promise<unknown>
  getMediaContinueWatching: () => Promise<unknown[]>
  toggleMediaEpisodeCompleted: (tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null, completed: boolean) => Promise<unknown>

  // Settings
  getSetting: (key: string) => Promise<string>
  setSetting: (key: string, value: string) => Promise<void>
  getAllSettings: () => Promise<Record<string, string>>
  resetSettings: () => Promise<void>

  // Window
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void
  getAppVersion: () => Promise<string>

  // Updater
  onUpdateAvailable: (callback: (version: string) => void) => () => void
  onUpdateDownloaded: (callback: (version: string) => void) => () => void
  restartToUpdate: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AnimeWatchAPI
  }
}
