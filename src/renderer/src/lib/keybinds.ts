/**
 * Keyboard shortcuts.
 *
 * Combos are stored as portable strings like "Mod+K". "Mod" resolves to ⌘ on
 * macOS and Ctrl elsewhere, so one saved value works on every platform.
 */

export type KeybindId = 'palette' | 'reload' | 'settings' | 'list'

export interface KeybindAction {
  id: KeybindId
  label: string
  description: string
  defaultCombo: string
}

export const KEYBIND_ACTIONS: KeybindAction[] = [
  {
    id: 'palette',
    label: 'Search everything',
    description: 'Open the floating search over any page',
    defaultCombo: 'Mod+K'
  },
  {
    id: 'reload',
    label: 'Reload',
    description: 'Reload the app window',
    defaultCombo: 'Mod+R'
  },
  {
    id: 'settings',
    label: 'Open settings',
    description: 'Jump straight to settings',
    defaultCombo: 'Mod+S'
  },
  { id: 'list', label: 'Open My List', description: 'Jump to your library', defaultCombo: 'Mod+L' }
]

export const IS_MAC = navigator.userAgent.includes('Macintosh')

export type KeybindMap = Record<KeybindId, string>

export function defaultKeybinds(): KeybindMap {
  return KEYBIND_ACTIONS.reduce((acc, a) => {
    acc[a.id] = a.defaultCombo
    return acc
  }, {} as KeybindMap)
}

/** Parse a stored map, falling back to defaults for anything missing or bad. */
export function parseKeybinds(raw: string | undefined | null): KeybindMap {
  const map = defaultKeybinds()
  if (!raw) return map
  try {
    const saved = JSON.parse(raw) as Partial<KeybindMap>
    for (const action of KEYBIND_ACTIONS) {
      const combo = saved[action.id]
      if (typeof combo === 'string' && combo.trim()) map[action.id] = combo
    }
  } catch {
    /* malformed setting — defaults stand */
  }
  return map
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵',
  Escape: 'Esc',
  ' ': 'Space'
}

/** Human-readable combo for display, e.g. "⌘K" on macOS, "Ctrl+K" elsewhere. */
export function formatCombo(combo: string): string {
  const parts = combo.split('+')
  const out = parts.map((p) => {
    if (p === 'Mod') return IS_MAC ? '⌘' : 'Ctrl'
    if (p === 'Shift') return IS_MAC ? '⇧' : 'Shift'
    if (p === 'Alt') return IS_MAC ? '⌥' : 'Alt'
    return KEY_LABELS[p] ?? p.toUpperCase()
  })
  return IS_MAC ? out.join('') : out.join('+')
}

/** Build a combo string from a keydown, or null if it is only modifiers. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(key)) return null

  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('Mod')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  parts.push(key.length === 1 ? key.toUpperCase() : key)
  return parts.join('+')
}

export function matchesCombo(combo: string, e: KeyboardEvent): boolean {
  const pressed = comboFromEvent(e)
  return pressed !== null && pressed.toLowerCase() === combo.toLowerCase()
}

/** True when focus is in a field, so shortcuts do not steal ordinary typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
