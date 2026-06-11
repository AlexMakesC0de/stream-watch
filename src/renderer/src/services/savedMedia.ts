import { useSyncExternalStore } from 'react'
import type { MediaType } from '@/types'

/**
 * Tiny shared store of which TMDB titles are in the local library, so the
 * "save" bookmark on every card reflects real membership (and stays in sync
 * across rows where the same title appears). Loaded once, lazily.
 */

const keyOf = (id: number, type: MediaType): string => `${type}:${id}`

let savedKeys = new Set<string>()
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function ensureLoaded(): void {
  if (loadPromise) return
  loadPromise = (async () => {
    try {
      const lib = (await window.api.getMediaLibrary()) as Array<{
        tmdb_id: number
        media_type: MediaType
      }>
      savedKeys = new Set(lib.map((m) => keyOf(m.tmdb_id, m.media_type)))
    } catch {
      savedKeys = new Set()
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
export function setSavedLocal(id: number, type: MediaType, on: boolean): void {
  const k = keyOf(id, type)
  if (on === savedKeys.has(k)) return
  savedKeys = new Set(savedKeys)
  if (on) savedKeys.add(k)
  else savedKeys.delete(k)
  emit()
}

/** React hook: is this title currently in the library? */
export function useSaved(id: number, type: MediaType): boolean {
  return useSyncExternalStore(
    subscribe,
    () => savedKeys.has(keyOf(id, type))
  )
}
