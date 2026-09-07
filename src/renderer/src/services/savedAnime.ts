import { useSyncExternalStore } from 'react'

/**
 * Anime counterpart of savedMedia: which AniList titles are in the local
 * library, so the bookmark on an anime card reflects real membership and stays
 * in sync everywhere the same title appears.
 */

let savedIds = new Set<number>()
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function ensureLoaded(): void {
  if (loadPromise) return
  loadPromise = (async () => {
    try {
      const lib = (await window.api.getLibrary()) as Array<{ anilist_id: number }>
      savedIds = new Set(lib.map((a) => a.anilist_id))
    } catch {
      savedIds = new Set()
    }
    emit()
  })()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  ensureLoaded()
  return () => {
    listeners.delete(listener)
  }
}

/** Reflect a save/unsave locally (after the DB write) and notify subscribers. */
export function setAnimeSavedLocal(anilistId: number, on: boolean): void {
  if (on === savedIds.has(anilistId)) return
  savedIds = new Set(savedIds)
  if (on) savedIds.add(anilistId)
  else savedIds.delete(anilistId)
  emit()
}

/** React hook: is this anime currently in the library? */
export function useAnimeSaved(anilistId: number): boolean {
  return useSyncExternalStore(subscribe, () => savedIds.has(anilistId))
}
