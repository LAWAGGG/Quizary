import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Flag } from 'lucide-react'

/**
 * ConfirmSubmitModal — konfirmasi sebelum submit:
 * menampilkan ringkasan sudah dijawab / belum dijawab / ditandai ragu.
 */
export function ConfirmSubmitModal({
  show,
  title,
  answeredCount,
  totalCount,
  missing,
  reviewedCount,
  onConfirm,
  onCancel,
  loading,
  confirmText = 'Submit Now',
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            className="bg-white dark:bg-ink-900 rounded-2xl p-6 w-full max-w-md shadow-lift max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100">{title}</h3>

            <div className="grid grid-cols-3 gap-2.5 mt-4 shrink-0">
              <SummaryChip
                icon={<CheckCircle2 className="w-4 h-4" />}
                tint="bg-correct-soft text-correct"
                label="Answered"
                value={answeredCount}
              />
              <SummaryChip
                icon={<AlertTriangle className="w-4 h-4" />}
                tint={missing.length ? 'bg-incorrect-soft text-incorrect' : 'bg-gray-100 dark:bg-ink-800 text-gray-400 dark:text-gray-500'}
                label="Unanswered"
                value={totalCount - answeredCount}
              />
              <SummaryChip
                icon={<Flag className="w-4 h-4" />}
                tint={reviewedCount ? 'bg-warn-soft text-warn' : 'bg-gray-100 dark:bg-ink-800 text-gray-400 dark:text-gray-500'}
                label="Marked"
                value={reviewedCount}
              />
            </div>

            {missing.length > 0 && (
              <div className="mt-4 shrink-0">
                <p className="text-sm font-medium text-incorrect">
                  {missing.length} required question(s) unanswered:
                </p>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                  {missing.map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full bg-incorrect shrink-0 mt-1.5" />
                      <span className="line-clamp-2">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 shrink-0">
              {missing.length
                ? 'You can still go back and fill in empty questions.'
                : 'Make sure all answers are correct before submitting.'}
            </p>

            <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                onClick={onCancel}
                disabled={loading}
                className="h-10 px-4 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors disabled:opacity-50"
              >
                {missing.length ? 'Back to quiz' : 'Cancel'}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading || missing.length > 0}
                className={`inline-flex items-center gap-2 text-sm font-semibold h-10 px-5 rounded-xl text-white transition-all duration-150
                  active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-chip
                  bg-primary hover:bg-primary-600`}
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {missing.length ? 'Fill required first' : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SummaryChip({ icon, tint, label, value }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl px-2 py-3 text-center border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-ink-800/50">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tint}`}>{icon}</span>
      <span className="text-sm font-bold text-ink dark:text-gray-100 mt-1.5 tabular-nums">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  )
}
