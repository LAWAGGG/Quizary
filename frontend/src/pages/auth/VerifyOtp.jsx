import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Button, Input, Card } from '../../components/ui'
import { AuthShell } from '../../components/auth/AuthShell'

const RESEND_SECONDS = 60

export default function VerifyOtp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { verifyOtp, resendOtp } = useAuth()
  const from = searchParams.get('next')

  const initialEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const onCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (error) setError('')
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(code)) {
      setError(t('auth.otpCodeInvalid'))
      return
    }
    if (!email) {
      setError(t('auth.emailRequired'))
      return
    }
    setVerifying(true)
    try {
      await verifyOtp(email, code)
      navigate(from || '/', { replace: true })
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message
      if (status === 409) setNotice(t('auth.otpAlreadyVerified'))
      else if (status === 410) setError(t('auth.otpExpired'))
      else if (status === 400 && String(msg).includes('attempts')) setError(t('auth.otpTooMany'))
      else setError(t('auth.otpVerifyError'))
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending || !email) return
    setError('')
    setNotice('')
    setResending(true)
    try {
      await resendOtp(email)
      setNotice(t('auth.otpResent'))
      setCountdown(RESEND_SECONDS)
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message
      if (status === 429 || String(msg).includes('wait')) setError(t('auth.otpWait'))
      else setError(msg || t('auth.somethingWrong'))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      eyebrow={t('auth.otpEyebrow')}
      title={t('auth.otpTitle')}
      subtitle={`${t('auth.otpSubtitle')} ${email || '...'}`}
      footer={
        <>
          <Link to="/login" className="font-semibold text-primary hover:text-primary-600 transition-colors">
            {t('auth.otpBackToLogin')}
          </Link>
        </>
      }
    >
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="p-6 md:p-7">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-incorrect-soft border border-incorrect/20 text-incorrect px-4 py-3 rounded-xl text-sm mb-5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-primary-50 border border-primary/20 text-primary-700 px-4 py-3 rounded-xl text-sm mb-5"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {notice}
            </motion.div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="relative">
              <Input
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!initialEmail}
                className="pl-10 disabled:opacity-60"
                required
              />
              <Mail className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
            </div>

            <div className="relative">
              <Input
                label={t('auth.otpCodeLabel')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t('auth.otpCodePlaceholder')}
                value={code}
                onChange={onCodeChange}
                className="pl-10 text-center font-mono text-lg tracking-[0.5em]"
              />
              <ShieldCheck className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
            </div>

            <Button type="submit" loading={verifying} className="w-full" size="lg">
              {t('auth.otpVerify')}
            </Button>
          </form>

          <div className="mt-5 text-center">
            {countdown > 0 ? (
              <p className="text-sm text-gray-400">{t('auth.otpResendIn', { countdown })}</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !email}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-600 transition-colors disabled:opacity-50"
              >
                {resending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('auth.otpResend')}
              </button>
            )}
          </div>
        </Card>
      </motion.div>
    </AuthShell>
  )
}
