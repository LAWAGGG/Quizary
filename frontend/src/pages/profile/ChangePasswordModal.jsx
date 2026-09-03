import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Lock } from 'lucide-react'
import api from '../../api/client'
import { Button } from '../../components/ui'
import { useToast } from '../../hooks/useToast'

function PasswordField({ id, label, value, onChange, error, hint, show, onToggle, autoComplete }) {
  const { t } = useTranslation()
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`input-field pr-11 ${error ? 'border-incorrect focus:border-incorrect focus:ring-incorrect/10' : ''}`}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">{error}</p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  )
}

export default function ChangePasswordModal({ show, onClose }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [values, setValues] = useState({ old: '', pw: '', confirm: '' })
  const [visible, setVisible] = useState({ old: false, pw: false, confirm: false })
  const [errors, setErrors] = useState({ old: '', pw: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }))
  const toggle = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }))

  const reset = () => {
    setValues({ old: '', pw: '', confirm: '' })
    setErrors({ old: '', pw: '', confirm: '' })
    setVisible({ old: false, pw: false, confirm: false })
  }

  const close = () => {
    if (loading) return
    reset()
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = { old: '', pw: '', confirm: '' }
    if (!values.old.trim()) next.old = t('profile.password.oldRequired')
    if (values.pw.length < 8) next.pw = t('profile.password.tooShort')
    if (!values.confirm.trim()) next.confirm = t('profile.password.confirmRequired')
    if (next.old || next.pw || next.confirm) {
      setErrors(next)
      return
    }
    if (values.pw !== values.confirm) {
      setErrors({ old: '', pw: '', confirm: t('profile.password.mismatch') })
      return
    }
    if (values.pw === values.old) {
      setErrors({ old: '', pw: t('profile.password.sameAsOld'), confirm: '' })
      return
    }

    setLoading(true)
    setErrors({ old: '', pw: '', confirm: '' })
    try {
      await api.put('/me/password', {
        old_password: values.old,
        new_password: values.pw,
        new_password_confirmation: values.confirm,
      })
      toast.success(t('profile.password.success'))
      close()
    } catch (err) {
      const data = err.response?.data || {}
      const fields = {}
      for (const item of data.errors || []) fields[Object.keys(item)[0]] = item[Object.keys(item)[0]]
      const message = typeof data.message === 'string' ? data.message.toLowerCase() : ''
      const joined = `${message} ${Object.values(fields).join(' ')}`.toLowerCase()
      if (fields.old_password || joined.includes('old password') || joined.includes('incorrect')) {
        setErrors((prev) => ({ ...prev, old: t('profile.password.oldIncorrect') }))
      } else if (joined.includes('different from old')) {
        setErrors((prev) => ({ ...prev, pw: t('profile.password.sameAsOld') }))
      } else if (joined.includes('match')) {
        setErrors((prev) => ({ ...prev, confirm: t('profile.password.mismatch') }))
      } else if (joined.includes('least') || fields.new_password) {
        setErrors((prev) => ({ ...prev, pw: t('profile.password.tooShort') }))
      } else {
        toast.error(t('profile.password.genericError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('profile.password.title')}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            className="bg-white dark:bg-ink-900 rounded-2xl p-6 w-full max-w-md shadow-lift border border-gray-100 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100">
                  {t('profile.password.title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('profile.password.desc')}</p>
              </div>
            </div>

            <form onSubmit={submit} noValidate className="mt-5 space-y-4">
              <PasswordField
                id="old-password"
                label={t('profile.password.old')}
                value={values.old}
                onChange={set('old')}
                error={errors.old}
                show={visible.old}
                onToggle={() => toggle('old')}
                autoComplete="current-password"
              />
              <PasswordField
                id="new-password"
                label={t('profile.password.new')}
                value={values.pw}
                onChange={set('pw')}
                error={errors.pw}
                hint={t('profile.password.newHint')}
                show={visible.pw}
                onToggle={() => toggle('pw')}
                autoComplete="new-password"
              />
              <PasswordField
                id="confirm-password"
                label={t('profile.password.confirm')}
                value={values.confirm}
                onChange={set('confirm')}
                error={errors.confirm}
                show={visible.confirm}
                onToggle={() => toggle('confirm')}
                autoComplete="new-password"
              />

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={loading}>
                  {t('profile.cancel')}
                </Button>
                <Button type="submit" loading={loading}>
                  {t('profile.password.update')}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
