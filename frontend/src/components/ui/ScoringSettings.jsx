import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Select } from './Select'

export function ScoringSettings({ mode = 'auto', onModeChange, questions = [], saving = false, onBatchUpdate }) {
  const scored = questions.filter((q) => q.is_scored !== false)
  const count = scored.length || 1
  const autoPoints = Math.round((100 / count) * 10) / 10

  const [points, setPoints] = useState(5)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const handleApply = async () => {
    if (!onBatchUpdate) return
    setApplying(true)
    try {
      await onBatchUpdate(points)
      setApplied(true)
      setTimeout(() => setApplied(false), 1500)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={mode}
        onChange={(e) => onModeChange?.(e.target.value)}
        disabled={saving || applying}
        className="w-[140px]"
      >
        <option value="auto">Auto grade</option>
        <option value="manual">Manual</option>
      </Select>

      {mode === 'auto' ? (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          100 ÷ {count} = {autoPoints} pts each
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">Weight:</span>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="h-8 w-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 px-2 text-center text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            min={1}
            max={100}
            disabled={applying}
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || applied}
            className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : applied ? <Check className="h-3.5 w-3.5" /> : 'Apply'}
          </button>
        </div>
      )}
    </div>
  )
}
