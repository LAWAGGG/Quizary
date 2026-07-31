import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Card, Button, Input, Badge, PageHeader } from '../../components/ui'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setAvatarPreview(user.avatar || null)
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('name', name)
      const res = await api.put('/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser(res.data)
      setMessage({ type: 'success', text: 'Profile updated successfully' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile' })
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
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('avatar', avatar)
      const res = await api.post('/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser(res.data)
      setAvatarPreview(res.data.avatar)
      setAvatar(null)
      setMessage({ type: 'success', text: 'Avatar uploaded successfully' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to upload avatar' })
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
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lift">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display text-3xl font-bold text-gray-400 bg-primary-50">
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
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="field-hint">Email cannot be changed.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="field-label !mb-1">Role</p>
                <p className="text-xs text-gray-400">Permissions granted to your account.</p>
              </div>
              <Badge scheme={user?.role === 'admin' ? 'primary' : 'blue'}>
                {(user?.role || 'user').toUpperCase()}
              </Badge>
            </div>

            {message && (
              <div className={`px-4 py-3 rounded-xl text-sm ${
                message.type === 'success' ? 'bg-correct-soft text-correct' : 'bg-incorrect-soft text-incorrect'
              }`}>
                {message.text}
              </div>
            )}

            <Button onClick={handleSave} loading={saving} className="w-full" size="lg">
              Save Changes
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
