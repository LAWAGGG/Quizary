import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

export const MAX_ANSWER_KEYS = 10
export const MAX_ANSWER_KEY_LEN = 100

export function splitAnswerKeys(raw) {
  return String(raw || '').split(/[;\n]+/).map((k) => k.trim()).filter(Boolean)
}

// Editor kunci jawaban ala opsi: daftar chip + tambah/hapus per kunci.
// Payload tetap string join ";" agar backend/grading/import tidak berubah.
export function AnswerKeyEditor({ value, onChange, required, error, inputRef }) {
  const { t } = useTranslation()
  const keys = splitAnswerKeys(value)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState('')

  const commitDraft = () => {
    const v = draft.trim()
    if (!v) return
    if (v.length > MAX_ANSWER_KEY_LEN) {
      setDraftError(t('answerKey.tooLong', { max: MAX_ANSWER_KEY_LEN }))
      return
    }
    if (keys.length >= MAX_ANSWER_KEYS) {
      setDraftError(t('answerKey.max', { max: MAX_ANSWER_KEYS }))
      return
    }
    if (keys.some((k) => k.toLowerCase() === v.toLowerCase())) {
      setDraftError(t('answerKey.duplicate'))
      return
    }
    setDraftError('')
    setDraft('')
    onChange([...keys, v].join('; '))
  }

  const removeKey = (idx) => {
    setDraftError('')
    onChange(keys.filter((_, i) => i !== idx).join('; '))
  }

  return (
    <div>
      <label className="field-label">
        {t('answerKey.label')}
        {required && <span className="text-incorrect ml-0.5">*</span>}
      </label>
      {keys.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2.5">
          {keys.map((k, i) => (
            <li
              key={`${k}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary/20 pl-3 pr-1.5 py-1 text-sm text-primary-700 dark:text-primary-300"
            >
              <span className="min-w-0 truncate font-mono">{k}</span>
              <button
                type="button"
                onClick={() => removeKey(i)}
                aria-label={t('answerKey.remove', { key: k })}
                className="shrink-0 p-1 rounded-full hover:bg-primary/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (draftError) setDraftError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft() } }}
          placeholder={t('answerKey.placeholder')}
          maxLength={MAX_ANSWER_KEY_LEN}
          spellCheck={false}
          disabled={keys.length >= MAX_ANSWER_KEYS}
          className={`input-field font-mono ${(error || draftError) ? 'border-incorrect focus:border-incorrect' : ''}`}
        />
        <Button type="button" variant="secondary" size="sm" onClick={commitDraft} disabled={!draft.trim() || keys.length >= MAX_ANSWER_KEYS} icon={<Plus className="w-4 h-4" />} className="shrink-0 sm:self-start">
          {t('answerKey.add')}
        </Button>
      </div>
      {(draftError || error) && <p className="field-error">{draftError || error}</p>}
      {!error && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('answerKey.hintChip', { max: MAX_ANSWER_KEYS })}</p>}
    </div>
  )
}
