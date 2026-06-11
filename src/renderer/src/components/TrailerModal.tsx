import { useEffect } from 'react'
import { X } from 'lucide-react'

interface TrailerModalProps {
  youtubeKey: string
  title?: string
  onClose: () => void
}

/** Lightweight modal that plays a YouTube trailer in an iframe. */
export default function TrailerModal({ youtubeKey, title, onClose }: TrailerModalProps): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-dark-800/80 hover:bg-dark-700 text-white transition-colors"
        aria-label="Close trailer"
      >
        <X size={20} />
      </button>
      <div
        className="w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={`https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`}
          title={title || 'Trailer'}
          className="w-full h-full border-0"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  )
}
