/// <reference types="@electron-toolkit/preload" />

import type { ElectronAPI } from '@electron-toolkit/preload'

interface StreamingSource {
  url: string
  quality: string
  isM3U8: boolean
}

interface StreamingInfo {
  sources: StreamingSource[]
  headers?: Record<string, string>
  embedUrl?: string
}

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
  toggleEpisodeCompleted: (anilistId: number, episodeNumber: number, completed: boolean) => Promise<void>
  markAllEpisodesCompleted: (anilistId: number, totalEpisodes: number) => Promise<void>
  fetchEpisodeSources: (opts: {
    anilistId: number
    title: string
    titleEnglish: string | null
    episodeNumber: number
    audioType?: 'sub' | 'dub'
  }) => Promise<StreamingInfo>
  clearProviderCache: (anilistId: number) => Promise<void>
  // Media (movies/TV) methods
  addMedia: (media: Record<string, unknown>) => Promise<unknown>
  getMediaLibrary: (status?: string) => Promise<unknown[]>
  getMedia: (tmdbId: number, mediaType: string) => Promise<unknown>
  updateMediaStatus: (tmdbId: number, mediaType: string, status: string) => Promise<unknown>
  removeMedia: (tmdbId: number, mediaType: string) => Promise<unknown>
  saveMediaProgress: (progress: Record<string, unknown>) => Promise<unknown>
  getMediaProgress: (tmdbId: number, mediaType: string) => Promise<unknown[]>
  getMediaEpisodeProgress: (tmdbId: number, mediaType: string, seasonNumber: number, episodeNumber: number) => Promise<unknown>
  getMediaContinueWatching: () => Promise<unknown[]>
  toggleMediaEpisodeCompleted: (tmdbId: number, mediaType: string, seasonNumber: number | null, episodeNumber: number | null, completed: boolean) => Promise<unknown>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void
  getAppVersion: () => Promise<string>
  onUpdateAvailable: (callback: (version: string) => void) => () => void
  onUpdateDownloaded: (callback: (version: string) => void) => () => void
  restartToUpdate: () => void
  // Settings
  getSetting: (key: string) => Promise<string>
  setSetting: (key: string, value: string) => Promise<void>
  getAllSettings: () => Promise<Record<string, string>>
  resetSettings: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AnimeWatchAPI
  }
}
