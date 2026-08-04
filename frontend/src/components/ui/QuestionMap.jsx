import { motion } from 'framer-motion'

/**
 * QuestionMap — navigator grid 1..N dengan status:
 * answered (hijau), reviewed/tandai ragu (kuning), active (ungu), unanswered (abu).
 */
export function QuestionMap({ total, current, answered, reviewed, onSelect }) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const isActive = current === i
        const cls = isActive
          ? 'bg-white text-primary border-primary ring-2 ring-primary/30 shadow-chip'
          : reviewed[i]
            ? 'bg-warn text-white border-warn'
            : answered[i]
              ? 'bg-correct text-white border-correct'
              : 'bg-white text-gray-500 border-gray-200 hover:border-primary/40'
        return (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(i)}
            aria-label={`Go to question ${idx}`}
            aria-current={isActive ? 'step' : undefined}
            className={`w-full aspect-square rounded-xl text-sm font-semibold border transition-all ${cls}`}
          >
            {idx}
          </motion.button>
        )
      })}
    </div>
  )
}
