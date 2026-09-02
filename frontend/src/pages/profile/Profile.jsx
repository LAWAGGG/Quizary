import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { Card, Button, Input, Badge, PageHeader } from '../../components/ui'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const [showPassword, setShowPassword] = useState({ old: false, new: false, confirm: false })
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' })
  const [passwordErrors, setPasswordErrors] = useState({ old: '', new: '', confirm: '' })
  const [changing, setChanging] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const togglePassword = (field) => setShowPassword(prev => ({ ...prev, [field]: !prev[field] }))

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      setPasswordErrors(prev => ({ ...prev, confirm: t('profile.password.mismatch') }))
      return
    }
    setChanging(true)
    setPasswordErrors({ old: '', new: '', confirm: '' })
    try {
      await api.put('/me/password', {
        old_password: passwords.old,
        new_password: passwords.new,
        new_password_confirmation: passwords.confirm,
      })
      toast.success(t('profile.password.success'))
      setPasswords({ old: '', new: '', confirm: '' })
      setExpanded(false)
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || ''
      if (msg.toLowerCase().includes('old') || msg.toLowerCase().includes('incorrect')) {
        setPasswordErrors(prev => ({ ...prev, old: t('profile.password.oldIncorrect') }))
      } else if (msg.toLowerCase().includes('confirmation') || msg.toLowerCase().includes('match')) {
        setPasswordErrors(prev => ({ ...prev, confirm: msg || t('profile.password.mismatch') }))
      } else if (msg) {
        setPasswordErrors(prev => ({ ...prev, new: msg }))
      }
    } finally {
      setChanging(false)
    }
  }

  function PasswordField({ id, label, value, onChange, error, show, onToggle }) {
    return (
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          className="pr-10"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    )
  }

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setAvatarPreview(user.avatar || null)
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('name', name)
      const res = await api.put('/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser(res.data)
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleUploadAvatar = async () => {
    if (!avatar) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', avatar)
      const res = await api.post('/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser(res.data)
      setAvatarPreview(res.data.avatar)
      setAvatar(null)
      toast.success('Avatar uploaded successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        description="Update your name and avatar."
      />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <Card className="p-6 md:p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-ink-800 border-4 border-white dark:border-ink-800 shadow-lift">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display text-3xl font-bold text-gray-400 dark:text-gray-300 bg-primary-50 dark:bg-primary-900/30">
                    {(user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Change avatar"
                className="absolute -bottom-1 -right-1 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-chip hover:bg-primary-600 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
            {avatar && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUploadAvatar} loading={uploading}>Save Avatar</Button>
                <Button variant="ghost" size="sm" onClick={() => { setAvatar(null); setAvatarPreview(user?.avatar || null) }}>Cancel</Button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />

            <div>
              <Input
                label="Email"
                value={user?.email || ''}
                readOnly
                className="bg-gray-50 dark:bg-ink-800 text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* <div className="flex items-center justify-between">
              <div>
                <p className="field-label !mb-1">Role</p>
                <p className="text-xs text-gray-400">Permissions granted to your account.</p>
              </div>
              <Badge scheme={user?.role === 'admin' ? 'primary' : 'blue'}>
                {(user?.role || 'user').toUpperCase()}
              </Badge>
            </div> */}

            <Button onClick={handleSave} loading={saving} className="w-full" size="lg">
              Save Changes
            </Button>
          </div>
        </Card>

        <Card className="p-5 mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink dark:text-gray-100">{t('profile.password.title')}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('profile.password.desc')}</p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <PasswordField
                id="old-password"
                label={t('profile.password.old')}
                value={passwords.old}
                onChange={(v) => setPasswords(prev => ({ ...prev, old: v }))}
                error={passwordErrors.old}
                show={showPassword.old}
                onToggle={() => togglePassword('old')}
              />
              <PasswordField
                id="new-password"
                label={t('profile.password.new')}
                value={passwords.new}
                onChange={(v) => setPasswords(prev => ({ ...prev, new: v }))}
                error={passwordErrors.new}
                show={showPassword.new}
                onToggle={() => togglePassword('new')}
              />
              <PasswordField
                id="confirm-password"
                label={t('profile.password.confirm')}
                value={passwords.confirm}
                onChange={(v) => setPasswords(prev => ({ ...prev, confirm: v }))}
                error={passwordErrors.confirm}
                show={showPassword.confirm}
                onToggle={() => togglePassword('confirm')}
              />
              <Button onClick={handlePasswordChange} loading={changing} className="w-full" size="lg">
                {t('profile.password.update')}
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
