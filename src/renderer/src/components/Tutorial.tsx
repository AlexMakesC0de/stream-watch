import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft, Compass, Search, BookOpen, Play, MousePointerClick } from 'lucide-react'

const TUTORIAL_DISMISSED_KEY = 'tutorial-dismissed'

interface TutorialStep {
  title: string
  description: string
  icon: React.ReactNode
}

const steps: TutorialStep[] = [
  {
    title: 'Welcome to StreamWatch',
    description:
      'Anime, films and series in one place, with your watch history kept on this machine. This takes about a minute.',
    icon: <Play size={28} className="text-accent-light" />
  },
  {
    title: 'Everything you started is on Home',
    description:
      'Continue Watching sits under the hero and merges both catalogues, so a half-finished series and a half-finished film appear side by side with the time you have left.',
    icon: <Compass size={28} className="text-accent-light" />
  },
  {
    title: 'Browse from the top bar',
    description:
      'Movies, Series and Anime each open a browse view. Narrow it by genre, year, rating or cast, and clear any filter from the chips below the controls.',
    icon: <Search size={28} className="text-accent-light" />
  },
  {
    title: 'My List holds your library',
    description:
      'Save anything with the bookmark on its poster, then sort it into Watching, Plan to Watch, Completed, On Hold or Dropped from the title page.',
    icon: <BookOpen size={28} className="text-accent-light" />
  },
  {
    title: 'Resuming picks up where you stopped',
    description:
      'The play button on a title page names the exact episode it will resume and how long is left. Progress saves as you watch.',
    icon: <Play size={28} className="text-accent-light" />
  },
  {
    title: 'Episodes never skip on their own',
    description:
      'Films and series play through third-party sources, so StreamWatch will not advance an episode for you — it marks one watched when it ends, and you choose the next with Next or the episode list.',
    icon: <MousePointerClick size={28} className="text-accent-light" />
  }
]

export default function Tutorial(): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY)
      if (!dismissed) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    if (dontShowAgain) {
      try {
        localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true')
      } catch { /* ignore */ }
    }
  }, [dontShowAgain])

  const dismissPermanently = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true')
    } catch { /* ignore */ }
  }, [])

  const start = useCallback(() => {
    setStarted(true)
    setCurrentStep(0)
  }, [])

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      dismissPermanently()
    }
  }, [currentStep, dismissPermanently])

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

  if (!visible) return null

  const step = steps[currentStep]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {!started ? (
          /* ── Welcome prompt ─────────────────────────────── */
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Play size={32} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to StreamWatch!</h2>
            <p className="text-dark-400 text-sm mb-8">
              Would you like a quick tour of the app?
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={start}
                className="w-full py-2.5 bg-accent hover:bg-accent/80 text-white font-medium rounded-xl transition-colors"
              >
                Start Tour
              </button>
              <button
                onClick={dismiss}
                className="w-full py-2.5 bg-dark-800 hover:bg-dark-700 text-dark-300 font-medium rounded-xl transition-colors"
              >
                Skip
              </button>
            </div>

            <label className="flex items-center justify-center gap-2 mt-5 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent focus:ring-accent/30 cursor-pointer"
              />
              <span className="text-xs text-dark-500 group-hover:text-dark-400 transition-colors">
                Don't show again
              </span>
            </label>
          </div>
        ) : (
          /* ── Tutorial steps ─────────────────────────────── */
          <div>
            {/* Progress bar */}
            <div className="h-1 bg-dark-800">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>

            <div className="p-8">
              {/* Close button */}
              <button
                onClick={dismissPermanently}
                className="absolute top-4 right-4 p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X size={16} className="text-dark-500" />
              </button>

              {/* Icon */}
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-5">
                {step.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-dark-400 leading-relaxed">{step.description}</p>

              {/* Step counter */}
              <p className="text-xs text-dark-600 mt-4">
                {currentStep + 1} of {steps.length}
              </p>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={prev}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-dark-400 hover:text-white disabled:opacity-0 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                {/* Dots */}
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === currentStep ? 'bg-accent' : i < currentStep ? 'bg-accent/40' : 'bg-dark-700'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={next}
                  className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {currentStep === steps.length - 1 ? 'Done' : 'Next'}
                  {currentStep < steps.length - 1 && <ChevronRight size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
