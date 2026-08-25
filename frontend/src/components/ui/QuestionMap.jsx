import { motion } from 'framer-motion'

/**
 * QuestionMap — navigator grid 1..N dengan status:
 * answered (hijau), reviewed/tandai ragu (kuning), active (ungu/border), unanswered (abu).
 */
export function QuestionMap({ total, current, answered, reviewed, onSelect }) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const isActive = current === i

        // 1. Tentukan warna dasar berdasarkan status jawaban terlebih dahulu
        const statusCls = reviewed[i]
          ? 'bg-warn text-white border-warn'
          : answered[i]
            ? 'bg-correct text-white border-correct'
            : 'bg-white dark:bg-ink-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary/40'

        // 2. Tambahkan style tambahan khusus jika tombol sedang aktif (tanpa menimpa warna dasar)
        const activeCls = isActive
          ? 'border-primary dark:border-primary ring-4 ring-primary/40 shadow-chip z-10 scale-105'
          : ''

        return (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(i)}
            aria-label={`Go to question ${idx}`}
            aria-current={isActive ? 'step' : undefined}
            className={`w-full aspect-square rounded-xl text-sm font-black border-2 transition-all ${statusCls} ${activeCls}`}
          >
            {idx}
          </motion.button>
        )
      })}
    </div>
  )
}
