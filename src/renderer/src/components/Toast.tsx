import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Undo2, X } from 'lucide-react'

const DISMISS_MS = 3600

interface ToastRequest {
  message: string
  /** Renders an Undo action. Runs on click, then the toast closes. */
  onUndo?: () => void | Promise<void>
}

interface ToastRecord extends ToastRequest {
  id: number
}

const ToastContext = createContext<(t: ToastRequest) => void>(() => {})

/** Fire a transient confirmation, optionally with an Undo. */
export function useToast(): (t: ToastRequest) => void {
  return useContext(ToastContext)
}

function ToastItem({
  toast,
  onClose
}: {
  toast: ToastRecord
  onClose: (id: number) => void
}): JSX.Element {
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onClose(toast.id), 180)
  }, [onClose, toast.id])

  useEffect(() => {
    timerRef.current = setTimeout(close, DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [close])

  // Hovering holds the toast open — an undo you cannot reach is not an undo.
  const hold = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }
  const resume = (): void => {
    timerRef.current = setTimeout(close, DISMISS_MS)
  }

  return (
    <div
      role="status"
      onMouseEnter={hold}
      onMouseLeave={resume}
      className={`pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-lg
                  bg-dark-800 border border-dark-600 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.9)]
                  transition-all duration-200 ${
                    leaving ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
                  }`}
    >
      <span className="text-sm text-dark-100">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={async () => {
            hold()
            await toast.onUndo?.()
            close()
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-accent-light hover:text-white transition-colors px-2 py-1 rounded-md"
        >
          <Undo2 size={14} />
          Undo
        </button>
      )}
      <button
        onClick={close}
        aria-label="Dismiss"
        className="p-1 rounded-md text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(1)

  const show = useCallback((t: ToastRequest) => {
    const id = nextId.current++
    // Keep the stack shallow; a pile of confirmations is noise, not feedback.
    setToasts((list) => [...list.slice(-2), { ...t, id }])
  }, [])

  const close = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={close} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
