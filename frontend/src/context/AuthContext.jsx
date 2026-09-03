import { useState, useCallback } from 'react'
import api from '../api/client'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      const res = await api.post('/login', { email, password })
      const data = res.data
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (name, email, password, password_confirmation) => {
    setLoading(true)
    try {
      // Register kini hanya membuat akun + mengirim OTP ke email — TIDAK auto-login.
      const res = await api.post('/register', { name, email, password, password_confirmation })
      return res.data
    } finally {
      setLoading(false)
    }
  }, [])

  const verifyOtp = useCallback(async (email, code) => {
    setLoading(true)
    try {
      const res = await api.post('/otp/verify', { email, code })
      const data = res.data
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  const resendOtp = useCallback(async (email) => {
    const res = await api.post('/otp/resend', { email })
    return res.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/logout')
    } catch { }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const updateUser = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, resendOtp, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
