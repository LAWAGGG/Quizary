import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

// Overlay loading non-dismissable untuk generate/accept AI.
// Logo putih berputar ease-in-out + teks tahap bergilir (persepsi progres,
// backend tidak streaming). Backdrop menahan semua klik halaman.
export function AiLoadingOverlay({ open, mode = 'generate' }) {
  const { t } = useTranslation()
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!open) return
    setStage(0)
    const id = setInterval(() => setStage((s) => (s + 1) % 3), 4000)
    return () => clearInterval(id)
  }, [open, mode])

  const steps = [t('aiGenerate.overlayStep1'), t('aiGenerate.overlayStep2'), t('aiGenerate.overlayStep3')]
  const title = mode === 'accept' ? t('aiGenerate.overlayAcceptTitle') : t('aiGenerate.overlayGenTitle')
  const desc = mode === 'accept' ? t('aiGenerate.overlayAcceptDesc') : t('aiGenerate.overlayGenDesc')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-busy="true"
          aria-label={title}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white dark:bg-ink-900 shadow-lift px-8 py-10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
            <div className="aurora-blob w-56 h-56 left-1/2 top-2 -translate-x-1/2 bg-primary/25" aria-hidden="true" />
            <div className="relative">
              <div className="mx-auto w-20 h-20 rounded-[22px] rounded-br-[8px] bg-gradient-to-br from-primary-500 to-primary-700 shadow-lift flex items-center justify-center">
                <img
                  src="/Quizary_Logo_White.png"
                  alt=""
                  className="w-11 h-11 object-contain animate-[spin_1.6s_ease-in-out_infinite]"
                />
              </div>
              <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-ink-800" aria-hidden="true">
                <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary-400 to-primary-600 animate-[overlay-shimmer_1.4s_ease-in-out_infinite]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-ink dark:text-gray-100">{title}</h3>
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3 text-sm font-semibold text-primary-600 dark:text-primary-300"
                  aria-live="polite"
                >
                  {steps[stage]}
                </motion.p>
              </AnimatePresence>
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('aiGenerate.overlayWait')}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
