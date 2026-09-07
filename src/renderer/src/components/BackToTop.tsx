import { ArrowUp } from 'lucide-react'

interface BackToTopProps {
  visible: boolean
  onClick: () => void
}

/** Appears once you are a screen or so down, bottom-right, out of the content. */
export default function BackToTop({ visible, onClick }: BackToTopProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-40 flex items-center justify-center w-11 h-11 rounded-full
                  bg-dark-800/95 border border-dark-600 text-dark-100 backdrop-blur-sm
                  shadow-[0_10px_26px_-8px_rgba(0,0,0,0.9)]
                  hover:bg-dark-700 hover:text-white
                  transition-all duration-200 ease-out ${
                    visible
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
    >
      <ArrowUp size={18} />
    </button>
  )
}
