/**
 * Formatting helpers for watch progress.
 *
 * Time *remaining* is what a viewer actually wants to know when deciding
 * whether to resume something, and it's what every streaming UI shows. The
 * previous inline `m:ss` formatter also broke past an hour — a 2h22m film
 * rendered as "142:30".
 */

/** e.g. "48m left", "1h 12m left". Null when there's nothing useful to say. */
export function formatTimeLeft(watchedSeconds: number, totalSeconds: number): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null
  const left = totalSeconds - watchedSeconds
  // Within half a minute of the end — treat as finished rather than "0m left".
  if (left <= 30) return null

  const minutes = Math.round(left / 60)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m left`
  return mins === 0 ? `${hours}h left` : `${hours}h ${mins}m left`
}

/** Watch progress as a 0-100 percentage, clamped and safe against bad durations. */
export function progressPercent(watchedSeconds: number, totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0
  return Math.min(100, Math.max(0, (watchedSeconds / totalSeconds) * 100))
}
