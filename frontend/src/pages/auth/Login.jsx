import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Card } from '../../components/ui'
import { AuthShell } from '../../components/auth/AuthShell'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const errors = {}
    if (!form.email) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Invalid email format'
    if (!form.password) errors.password = 'Password is required'
    else if (form.password.length < 8)
      errors.password = 'Password must be at least 8 characters'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message
      if (status === 422) {
        const errors = {}
        let schemaMsg = ''
        const details = err.response?.data?.errors || []
        details.forEach((e) => {
          const field = Object.keys(e)[0]
          if (!field) return
          if (field === '_schema') schemaMsg = e[field]
          else errors[field] = e[field]
        })
        if (schemaMsg) setError(schemaMsg)
        else if (Object.keys(errors).length) setFieldErrors(errors)
        else setError(msg || 'Validation failed')
      } else if (status === 401) {
        setError('Invalid email or password')
      } else {
        setError(msg || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your account"
      subtitle="Pick up where you left off and keep collecting answers."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-primary hover:text-primary-600 transition-colors">
            Sign up
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
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                error={fieldErrors.email}
                className="pl-10"
              />
              <Mail className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                error={fieldErrors.password}
                className="pl-10 pr-10"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3.5 top-12 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In
            </Button>
          </form>
        </Card>
      </motion.div>
    </AuthShell>
  )
}
