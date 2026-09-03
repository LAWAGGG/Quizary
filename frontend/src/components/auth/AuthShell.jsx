import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Timer, Check, Star, FileUp, FileText, Image as ImageIcon, Play, Upload } from 'lucide-react'
import { AppMark } from '../ui'

const OPTIONS = [
  { letter: 'A', value: '54' },
  { letter: 'B', value: '56', correct: true },
  { letter: 'C', value: '63' },
  { letter: 'D', value: '48' },
]

const WAVE_BARS = [10, 16, 22, 14, 26, 18, 30, 12, 20, 24, 16, 28, 14, 22, 18, 26, 12, 20]
const SLIDE_COUNT = 3
const SLIDE_MS = 4000

function QuizSlide() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-600">
          <Star className="w-3.5 h-3.5" />
          {t('auth.promoTag')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 font-mono text-xs font-bold text-white">
          <Timer className="w-3.5 h-3.5" />
          00:42
        </span>
      </div>

      <p className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">7 × 8 = ?</p>

      <div className="mt-4 space-y-2">
        {OPTIONS.map((opt) => (
          <div
            key={opt.letter}
            className={`flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-sm font-semibold ${
              opt.correct
                ? 'border-correct bg-correct-soft text-ink'
                : 'border-gray-100 bg-white text-gray-500'
            }`}
          >
            <span className={`bubble w-7 h-7 text-sm ${opt.correct ? 'bubble-correct' : 'bubble-empty'}`}>
              {opt.correct ? <Check className="w-4 h-4" strokeWidth={3} /> : opt.letter}
            </span>
            <span className="font-mono text-base">{opt.value}</span>
          </div>
        ))}
      </div>

      <motion.span
        initial={{ scale: 0, rotate: 20 }}
        animate={{ scale: 1, rotate: 8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.3 }}
        className="absolute -top-5 -right-3 inline-flex items-center gap-1 rounded-full bg-correct px-4 py-2 text-sm font-bold text-white shadow-lift"
      >
        <Check className="w-4 h-4" strokeWidth={3} />
        +100
      </motion.span>
    </div>
  )
}

function UploadSlide() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-600">
          <FileUp className="w-3.5 h-3.5" />
          {t('auth.promoTagUpload')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-correct px-3 py-1 text-xs font-bold text-white">
          <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
          {t('auth.promoSubmitted')}
        </span>
      </div>

      <p className="mt-4 font-display text-2xl font-bold tracking-tight text-ink">{t('auth.promoUploadQ')}</p>

      <div className="mt-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-50/50 p-6 flex flex-col items-center text-center">
        <span className="grid place-items-center w-12 h-12 rounded-full bg-primary text-white shadow-chip">
          <Upload className="w-5 h-5" strokeWidth={2.5} />
        </span>
        <p className="mt-3 font-mono text-sm font-bold text-ink">jawaban.pdf</p>
        <p className="font-mono text-xs text-gray-400">2,4 MB</p>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-correct bg-correct-soft px-3.5 py-2.5">
        <FileText className="w-5 h-5 text-correct shrink-0" />
        <div className="flex-1 h-2 rounded-full bg-white overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
            className="h-full rounded-full bg-correct"
          />
        </div>
        <Check className="w-4 h-4 text-correct shrink-0" strokeWidth={3} />
      </div>
    </div>
  )
}

function EssaySlide() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-600">
          <Star className="w-3.5 h-3.5" />
          {t('auth.promoTagEssay')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 font-mono text-xs font-bold text-white">
          <Timer className="w-3.5 h-3.5" />
          00:37
        </span>
      </div>

      <div className="mt-4 grid place-items-center h-28 rounded-2xl bg-primary-100">
        <ImageIcon className="w-10 h-10 text-primary-400" />
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-full bg-ink pl-2 pr-4 py-2">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-white text-ink shrink-0">
          <Play className="w-4 h-4 ml-0.5" />
        </span>
        <span className="flex items-center gap-1 flex-1 h-8" aria-hidden="true">
          {WAVE_BARS.map((h, i) => (
            <span
              key={i}
              style={{ height: h }}
              className={`w-1 rounded-full ${i < 7 ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </span>
        <span className="font-mono text-xs font-bold text-white shrink-0">00:37</span>
      </div>

      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="h-2.5 rounded-full bg-gray-100 w-full" />
        <div className="h-2.5 rounded-full bg-gray-100 w-11/12" />
        <div className="h-2.5 rounded-full bg-gray-100 w-2/3" />
      </div>
    </div>
  )
}

function PromoCard() {
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDE_COUNT), SLIDE_MS)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="relative">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -6 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.15 }}
        className="relative rounded-3xl bg-white p-6 shadow-lift ring-1 ring-black/5 min-h-[400px]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {slide === 0 && <QuizSlide />}
            {slide === 1 && <UploadSlide />}
            {slide === 2 && <EssaySlide />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      </motion.div>
    </div>
  )
}

export function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-primary-800 text-white p-12 overflow-hidden relative">
        <div className="absolute inset-0 dot-grid-light opacity-40 pointer-events-none" aria-hidden="true" />

        <div className="flex items-center gap-3 relative">
          <img src="/Quizary_Logo_White.png" alt="Quizary logo" className="w-7 h-7 object-contain select-none shrink-0" />
          <span className="font-display font-bold text-xl">Quizary</span>
        </div>

        <div className="relative w-full max-w-xl mx-auto flex-1 flex flex-col justify-center py-8">
          <p className="eyebrow !text-primary-200">{t('auth.promoEyebrow')}</p>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.15] tracking-tight">
            {t('auth.promoTitle')}
          </h2>
          <div className="mt-8">
            <PromoCard />
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-paper dark:bg-ink-950 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <AppMark size="sm" />
            <span className="font-display font-bold text-lg text-ink dark:text-gray-100">Quizary</span>
          </div>

          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink dark:text-gray-100">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
