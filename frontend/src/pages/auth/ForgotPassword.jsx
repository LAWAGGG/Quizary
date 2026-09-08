import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, AlertCircle, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Button, Input, Card } from '../../components/ui'
import { AuthShell } from '../../components/auth/AuthShell'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    if (!email) {
      setFieldError(t('auth.emailRequired'))
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(t('auth.emailInvalid'))
      return false
    }
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldError('')
    if (!validate()) return
    setLoading(true)
    try {
      await forgotPassword(email)
      navigate(`/reset-password?email=${encodeURIComponent(email)}`, { replace: true })
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message
      if (status === 429) setError(t('auth.otpWait'))
      else if (status === 422) {
        const details = err.response?.data?.errors || []
        const f = details.find((x) => Object.keys(x)[0] === 'email')
        if (f) setFieldError(f.email)
        else setError(msg || t('auth.validationFailed'))
      } else setError(msg || t('auth.somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow={t('auth.forgotEyebrow')}
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      footer={
        <>
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('auth.backToLogin')}
          </Link>
        </>
      }
    >
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="p-6 md:p-7">
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-incorrect-soft border border-incorrect/20 text-incorrect px-4 py-3 rounded-xl text-sm mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Input
                label={t('auth.email')}
                type="email"
                placeholder={t('auth.emailPlaceholder') !== 'auth.emailPlaceholder' ? t('auth.emailPlaceholder') : 'email@example.com'}
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldError) setFieldError('') }}
                error={fieldError}
                className="pl-10"
                autoComplete="email"
              />
              <Mail className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {t('auth.forgotSubmit')}
            </Button>
          </form>
        </Card>
      </motion.div>
    </AuthShell>
  )
}
