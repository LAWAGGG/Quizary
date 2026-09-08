import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Button, Input, Card, AppMark, AuroraBg, DotCorner } from '../../components/ui'

const CODE_LEN = 6
const RESEND_SECONDS = 60

function OtpModal({ open, email, onVerified, onClose, t, forgotPassword, verifyResetCode }) {
  const [digits, setDigits] = useState(() => Array(CODE_LEN).fill(''))
  const code = digits.join('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const boxesRef = useRef([])

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => boxesRef.current[0]?.focus(), 60)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  function fail(msg) { setError(msg); setShakeKey((k) => k + 1) }

  function setDigit(i, ch) {
    const d = (ch || '').replace(/\D/g, '').slice(-1)
    setDigits((prev) => { const a = [...prev]; a[i] = d || ''; return a })
    if (error) setError('')
    if (d && i < CODE_LEN - 1) boxesRef.current[i + 1]?.focus()
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) { setDigit(i, ''); boxesRef.current[i]?.focus() }
      else if (i > 0) { setDigit(i - 1, ''); boxesRef.current[i - 1]?.focus() }
    } else if (e.key === 'ArrowLeft' && i > 0) boxesRef.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < CODE_LEN - 1) boxesRef.current[i + 1]?.focus()
    else if (e.key === 'Delete') { e.preventDefault(); setDigit(i, '') }
  }
  function handlePaste(e) {
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, CODE_LEN)
    if (!pasted) return
    e.preventDefault()
    setDigits(pasted.split('').concat(Array(CODE_LEN).fill('')).slice(0, CODE_LEN))
    if (error) setError('')
    boxesRef.current[Math.min(pasted.length, CODE_LEN - 1)]?.focus()
  }

  const handleVerify = useCallback(async () => {
    if (verifying) return
    if (!/^\d{6}$/.test(code)) { fail(t('auth.otpCodeInvalid')); return }
    if (!email) { fail(t('auth.emailRequired')); return }
    setError(''); setVerifying(true)
    try {
      await verifyResetCode(email, code)
      onVerified(code)
    } catch (err) {
      const s = err.response?.status; const m = err.response?.data?.message || ''
      if (s === 410) fail(t('auth.otpExpired'))
      else if (s === 400 && String(m).includes('attempts')) fail(t('auth.otpTooMany'))
      else if (s === 400) fail(t('auth.otpVerifyError'))
      else if (s === 429) fail(t('auth.otpWait'))
      else if (s === 404) fail(t('auth.resetEmailNotFound'))
      else if (s === 403) fail(t('auth.resetNotVerified'))
      else fail(m || t('auth.somethingWrong'))
    } finally { setVerifying(false) }
  }, [code, email, t, verifyResetCode, onVerified, verifying])

  // auto-verify once 6 digits filled
  const autoRef = useRef('')
  useEffect(() => {
    if (code.length === 6 && /^\d{6}$/.test(code) && autoRef.current !== code) {
      autoRef.current = code
      handleVerify()
    }
    if (code.length !== 6) autoRef.current = ''
  }, [code, handleVerify])

  async function handleResend() {
    if (countdown > 0 || resending || !email) return
    setError(''); setResending(true)
    try {
      await forgotPassword(email)
      setCountdown(RESEND_SECONDS)
      setDigits(Array(CODE_LEN).fill(''))
      boxesRef.current[0]?.focus()
    } catch (err) {
      const s = err.response?.status; const m = err.response?.data?.message
      if (s === 429 || String(m).includes('wait')) fail(t('auth.otpWait'))
      else fail(m || t('auth.somethingWrong'))
    } finally { setResending(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.96, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 8 }} className="bg-white dark:bg-ink-900 rounded-2xl p-6 w-full max-w-md shadow-lift border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
          
            <h3 className="font-display text-lg font-bold text-ink dark:text-gray-100">{t('auth.verifyCodeTitle')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('auth.verifyCodeDesc')} <span className="font-medium text-ink dark:text-gray-200">{email}</span></p>

            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-incorrect-soft border border-incorrect/20 text-incorrect px-3 py-2.5 rounded-xl text-sm mt-4" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </motion.div>
            )}

            <motion.div key={shakeKey} animate={shakeKey ? { x: [0, -9, 9, -5, 5, 0] } : {}} transition={{ duration: 0.4, ease: 'easeOut' }} className="grid grid-cols-6 gap-2 sm:gap-2.5 mt-5" onPaste={handlePaste} role="group" aria-label={t('auth.otpCodeLabel')}>
              {Array.from({ length: CODE_LEN }, (_, i) => {
                const filled = Boolean(digits[i])
                return (
                  <input
                    key={i}
                    ref={(el) => { boxesRef.current[i] = el }}
                    value={digits[i] || ''}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                    disabled={verifying}
                    className={`h-12 sm:h-14 w-full rounded-2xl border text-center font-mono text-xl font-semibold transition-all outline-none disabled:opacity-60 focus:scale-[1.04] ${error ? 'border-incorrect/60 bg-incorrect-soft/40 focus:border-incorrect focus:ring-2 focus:ring-incorrect/15' : filled ? 'border-primary/50 bg-primary-50/50 dark:bg-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-900 focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                  />
                )
              })}
            </motion.div>

            <Button onClick={handleVerify} loading={verifying} disabled={code.length !== 6 || verifying} className="w-full mt-4" size="lg">
              {t('auth.verifyCodeSubmit')}
            </Button>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('auth.otpNoCode')}</span>
              {countdown > 0 ? <span className="font-mono text-gray-400 shrink-0">{t('auth.otpResendIn', { countdown })}</span> : <button type="button" onClick={handleResend} disabled={resending} className="font-semibold text-primary hover:text-primary-600 disabled:opacity-50 transition-colors">{t('auth.otpResend')}</button>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { resetPassword, forgotPassword, verifyResetCode } = useAuth()
  const email = searchParams.get('email') || ''

  const [verifiedCode, setVerifiedCode] = useState('')
  const [showOtp, setShowOtp] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const handleVerified = (code) => {
    setVerifiedCode(code)
    setShowOtp(false)
    setError('')
    setNotice(t('auth.codeVerified'))
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    const errs = {}
    if (!verifiedCode) errs.code = t('auth.otpCodeInvalid')
    if (!password) errs.password = t('auth.passwordRequired')
    else if (password.length < 8) errs.password = t('auth.passwordMin')
    else if (!/^[!-~]+$/.test(password)) errs.password = t('auth.passwordInvalid')
    if (!confirm) errs.password_confirmation = t('auth.confirmRequired')
    else if (password !== confirm) errs.password_confirmation = t('auth.confirmMismatch')
    if (Object.keys(errs).length) { setFieldErrors(errs); setError(errs.password || errs.password_confirmation || errs.code); return }
    setFieldErrors({})
    setSubmitting(true)
    try {
      await resetPassword(email, verifiedCode, password, confirm)
      setNotice(t('auth.resetSuccess'))
      setTimeout(() => navigate('/login', { replace: true }), 900)
    } catch (err) {
      const s = err.response?.status; const m = err.response?.data?.message || ''
      const details = err.response?.data?.errors || []
      const map = {}
      details.forEach((x) => { const k = Object.keys(x)[0]; if (k && k !== '_schema') map[k] = x[k] })
      if (Object.keys(map).length) {
        setFieldErrors(map)
        fail: {
          const v = map.password || map.password_confirmation || map.code || map.email
          if (v) { setError(v); break fail }
          setError(m || t('auth.validationFailed'))
        }
        // code invalid -> reopen modal
        if (map.code || String(m).toLowerCase().includes('code')) setShowOtp(true)
        return
      }
      if (s === 410 || s === 400) { setError(m || t('auth.otpVerifyError')); setShowOtp(true) }
      else if (s === 429) setError(t('auth.otpWait'))
      else setError(m || t('auth.somethingWrong'))
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-dvh bg-paper dark:bg-ink-950 relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none dark:opacity-20" style={{ backgroundImage: 'radial-gradient(rgb(108 92 231 / 0.14) 1.5px, transparent 1.5px)', backgroundSize: '28px 28px', opacity: 0.25 }} aria-hidden="true" />
      <AuroraBg base="#6C5CE7" className="opacity-20" />
      <DotCorner position="top-left" color="#6C5CE7" />
      <DotCorner position="bottom-right" color="#6C5CE7" />

      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <AppMark size="sm" />
            <span className="font-display font-bold text-lg text-ink dark:text-gray-100">Quizary</span>
          </div>

          <h1 className="mt-2 text-center font-display text-3xl font-bold tracking-tight text-ink dark:text-gray-100">{t('auth.resetTitle')}</h1>
          <p className="mt-1.5 text-center text-sm text-gray-500 dark:text-gray-400">{verifiedCode ? t('auth.resetPasswordHint') : t('auth.resetNeedCode')}</p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-8">
            <Card className="p-6 md:p-7">
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-incorrect-soft border border-incorrect/20 text-incorrect px-4 py-3 rounded-xl text-sm mb-5" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </motion.div>
              )}
              {notice && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-primary-50 border border-primary/20 text-primary-700 px-4 py-3 rounded-xl text-sm mb-5">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> {notice}
                </motion.div>
              )}

              <div className="relative mb-5">
                <Input label={t('auth.email')} type="email" value={email} disabled readOnly className="pl-10 disabled:opacity-60" />
                <Mail className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
              </div>

              {!verifiedCode ? (
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary-50/50 dark:bg-primary-900/20 p-5 text-center">
                  <ShieldCheck className="w-8 h-8 text-primary mx-auto" />
                  <p className="mt-2 text-sm font-medium text-ink dark:text-gray-100">{t('auth.verifyCodeNeeded')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('auth.verifyCodeNeededHint')}</p>
                  <Button onClick={() => setShowOtp(true)} className="mt-4 w-full" size="lg">{t('auth.openVerifyModal')}</Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                
                  <div className="relative">
                    <Input label={t('auth.newPassword')} type={showPw ? 'text' : 'password'} placeholder={t('auth.passwordHint')} value={password} onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' })) }} error={fieldErrors.password} className="pl-10 pr-10" />
                    <Lock className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
                    <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3.5 top-12 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 transition-colors" aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}>{showPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}</button>
                  </div>
                  <div className="relative">
                    <Input label={t('auth.confirmPassword')} type={showConfirm ? 'text' : 'password'} placeholder={t('auth.confirmPassword')} value={confirm} onChange={(e) => { setConfirm(e.target.value); if (fieldErrors.password_confirmation) setFieldErrors((p) => ({ ...p, password_confirmation: '' })) }} error={fieldErrors.password_confirmation} className="pl-10 pr-10" />
                    <Lock className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
                    <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute right-3.5 top-12 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 transition-colors" aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}>{showConfirm ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}</button>
                  </div>
                  <Button type="submit" loading={submitting} className="w-full" size="lg">{t('auth.resetSubmit')}</Button>
                </form>
              )}

              <div className="mt-5 text-center">
                <Link to="/login" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">{t('auth.backToLogin')}</Link>
              </div>
            </Card>
          </motion.div>
        </div>
      </main>

      <OtpModal open={showOtp} email={email} onVerified={handleVerified} onClose={() => setShowOtp(false)} t={t} forgotPassword={forgotPassword} verifyResetCode={verifyResetCode} />
    </div>
  )
}
