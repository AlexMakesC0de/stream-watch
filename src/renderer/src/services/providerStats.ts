/**
 * Which embed sources actually work.
 *
 * Free embed hosts are up or down per *title*, not just per host — one can be
 * online and still have no stream for the thing you picked. The player used to
 * walk the same hardcoded list from position 0 on every single playback, so it
 * rediscovered the same dead ends every time. This records what worked and
 * reorders the list accordingly.
 */

const TITLE_KEY = 'providerByTitle'
const TALLY_KEY = 'providerTally'
/** Cap the per-title memory so the setting cannot grow without bound. */
const MAX_TITLES = 300

type TitleMap = Record<string, string>
type Tally = Record<string, { ok: number; fail: number }>

let titleMap: TitleMap = {}
let tally: Tally = {}
let loaded = false

export function titleKey(mediaType: string, tmdbId: number): string {
  return `${mediaType}:${tmdbId}`
}

export async function loadProviderStats(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const [rawTitles, rawTally] = await Promise.all([
      window.api.getSetting(TITLE_KEY),
      window.api.getSetting(TALLY_KEY)
    ])
    titleMap = rawTitles ? (JSON.parse(rawTitles) as TitleMap) : {}
    tally = rawTally ? (JSON.parse(rawTally) as Tally) : {}
  } catch {
    titleMap = {}
    tally = {}
  }
}

/** Success rate, with a mild prior so one lucky hit doesn't top the list. */
function score(name: string): number {
  const t = tally[name]
  if (!t) return 0.5
  const total = t.ok + t.fail
  if (total === 0) return 0.5
  return (t.ok + 1) / (total + 2)
}

/**
 * Reorder sources: whatever last worked for this exact title first, then by
 * how often each source has worked overall.
 */
export function orderProviders<T extends { name: string }>(
  providers: T[],
  key: string
): T[] {
  const preferred = titleMap[key]
  return [...providers].sort((a, b) => {
    if (a.name === preferred) return -1
    if (b.name === preferred) return 1
    return score(b.name) - score(a.name)
  })
}

function persist(): void {
  window.api.setSetting(TITLE_KEY, JSON.stringify(titleMap)).catch(() => {})
  window.api.setSetting(TALLY_KEY, JSON.stringify(tally)).catch(() => {})
}

function bump(name: string, field: 'ok' | 'fail'): void {
  const t = tally[name] ?? { ok: 0, fail: 0 }
  t[field] += 1
  // Decay so a source that broke months ago isn't buried forever, and a
  // formerly-good one doesn't coast on old wins.
  if (t.ok + t.fail > 40) {
    t.ok = Math.round(t.ok / 2)
    t.fail = Math.round(t.fail / 2)
  }
  tally[name] = t
}

export function recordSuccess(name: string, key: string): void {
  if (titleMap[key] === name && tally[name]) return // nothing new to store
  titleMap[key] = name

  // Simple LRU-ish trim: drop the oldest inserted keys past the cap.
  const keys = Object.keys(titleMap)
  if (keys.length > MAX_TITLES) {
    for (const k of keys.slice(0, keys.length - MAX_TITLES)) delete titleMap[k]
  }
  bump(name, 'ok')
  persist()
}

export function recordFailure(name: string, key: string): void {
  if (titleMap[key] === name) delete titleMap[key] // it stopped working
  bump(name, 'fail')
  persist()
}
