import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Changing this resets the boundary — used to recover on navigation. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * A render error used to unmount the whole app and leave a blank window that
 * only a reload could fix. Catch it here instead and offer a way back.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
        <AlertTriangle size={40} className="text-amber-400" />
        <div className="space-y-2 max-w-md">
          <p className="text-white text-lg font-semibold">This page hit a problem</p>
          <p className="text-dark-400 text-sm leading-relaxed">
            Nothing was lost — your library is saved. Try that page again, or reload the app.
          </p>
          <p className="text-dark-500 text-xs font-mono pt-1 break-all">{error.message}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => this.setState({ error: null })} className="btn-primary text-sm">
            <RefreshCw size={15} />
            Try again
          </button>
          <button onClick={() => window.location.reload()} className="btn-secondary text-sm">
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
