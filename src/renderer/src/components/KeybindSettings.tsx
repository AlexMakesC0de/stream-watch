import { useEffect, useRef, useState } from 'react'
import { Keyboard, RotateCcw } from 'lucide-react'
import {
  KEYBIND_ACTIONS,
  comboFromEvent,
  defaultKeybinds,
  formatCombo,
  type KeybindId,
  type KeybindMap
} from '@/lib/keybinds'

interface KeybindSettingsProps {
  value: KeybindMap
  onChange: (next: KeybindMap) => void
}

/** Rebind by clicking a shortcut and pressing the combination you want. */
export default function KeybindSettings({ value, onChange }: KeybindSettingsProps): JSX.Element {
  const [capturing, setCapturing] = useState<KeybindId | null>(null)
  const capturingRef = useRef<KeybindId | null>(null)
  capturingRef.current = capturing

  useEffect(() => {
    if (!capturing) return
    function onKey(e: KeyboardEvent): void {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(null)
        return
      }
      const combo = comboFromEvent(e)
      if (!combo) return // modifier-only press, keep waiting
      const id = capturingRef.current!
      // A combo can only drive one action; clear it from whoever held it.
      const next = { ...value } as KeybindMap
      for (const key of Object.keys(next) as KeybindId[]) {
        if (next[key].toLowerCase() === combo.toLowerCase()) next[key] = ''
      }
      next[id] = combo
      onChange(next)
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, value, onChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-dark-300">
          <Keyboard size={14} />
          Keyboard Shortcuts
        </label>
        <button
          onClick={() => onChange(defaultKeybinds())}
          className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-white transition-colors"
        >
          <RotateCcw size={12} />
          Reset to defaults
        </button>
      </div>

      <div className="rounded-lg border border-dark-700 divide-y divide-dark-700 overflow-hidden">
        {KEYBIND_ACTIONS.map((action) => {
          const combo = value[action.id]
          const isCapturing = capturing === action.id
          return (
            <div
              key={action.id}
              className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-dark-900"
            >
              <div className="min-w-0">
                <p className="text-sm text-white">{action.label}</p>
                <p className="text-xs text-dark-500 mt-0.5">{action.description}</p>
              </div>
              <button
                onClick={() => setCapturing(isCapturing ? null : action.id)}
                className={`shrink-0 min-w-[104px] px-3 py-1.5 rounded-md text-xs font-semibold tabular
                            border transition-colors ${
                              isCapturing
                                ? 'border-accent text-accent-light bg-accent/10 animate-pulse'
                                : 'border-dark-600 bg-dark-800 text-dark-100 hover:border-dark-500 hover:text-white'
                            }`}
              >
                {isCapturing ? 'Press keys…' : combo ? formatCombo(combo) : 'Not set'}
              </button>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-dark-500">
        Shortcuts are ignored while you are typing in a field, unless they use{' '}
        {formatCombo('Mod+K').replace('K', '')} .
      </p>
    </div>
  )
}
