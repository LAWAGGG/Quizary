import { Select } from './Select'

export function ScoringSettings({ mode = 'auto', onModeChange, questions = [], manualPoints = 5, onManualPointsChange }) {
  // Mirror filter backend batch_update_points (forms.py): tipe ini tak ikut
  // batch, essay hanya ikut bila punya answer_key.
  const NO_GRADE = ['date', 'time', 'datetime', 'file_upload', 'dropdown']
  const scored = questions.filter(
    (q) => q.is_scored !== false && !NO_GRADE.includes(q.type) && (q.type !== 'essay' || (q.answer_key || '').trim()),
  )
  const count = scored.length || 1
  const autoPoints = Math.round((100 / count) * 10) / 10

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={mode}
        onChange={(e) => onModeChange?.(e.target.value)}
        className="w-full sm:w-[140px]"
      >
        <option value="auto">Auto grade</option>
        <option value="manual">Manual</option>
      </Select>

      {mode === 'auto' ? (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          100 ÷ {count} = {autoPoints} pts each
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">Weight:</span>
          <input
            type="number"
            value={manualPoints}
            onChange={(e) => onManualPointsChange?.(Number(e.target.value))}
            className="h-8 w-16 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 px-2 text-center text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            min={1}
            max={100}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">pts each</span>
        </div>
      )}
    </div>
  )
}
