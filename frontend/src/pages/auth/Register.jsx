import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Card } from '../../components/ui'
import { AuthShell } from '../../components/auth/AuthShell'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const errors = {}
    if (!form.name) errors.name = 'Name is required'
    else if (form.name.length < 3)
      errors.name = 'Name must be at least 3 characters'
    if (!form.email) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Invalid email format'
    if (!form.password) errors.password = 'Password is required'
    else if (form.password.length < 8)
      errors.password = 'Password must be at least 8 characters'
    if (!form.password_confirmation)
      errors.password_confirmation = 'Password confirmation is required'
    else if (form.password !== form.password_confirmation)
      errors.password_confirmation = 'Passwords do not match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setLoading(true)
    try {
      await register(
        form.name,
        form.email,
        form.password,
        form.password_confirmation
      )
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
      } else if (status === 409) {
        setError('Email is already registered')
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
      eyebrow="Get started"
      title="Create your account"
      subtitle="Build, share, and grade quizzes in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:text-primary-600 transition-colors">
            Sign in
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="Name"
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                error={fieldErrors.name}
                className="pl-10"
              />
              <User className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
            </div>

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
                placeholder="At least 8 characters"
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

            <div className="relative">
              <Input
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password"
                value={form.password_confirmation}
                onChange={(e) => update('password_confirmation', e.target.value)}
                error={fieldErrors.password_confirmation}
                className="pl-10 pr-10"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-12 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3.5 top-12 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>
        </Card>
      </motion.div>
    </AuthShell>
  )
}
