import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function clearStaleAuth() {
  if (!localStorage.getItem('token') && !localStorage.getItem('user')) return
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.dispatchEvent(new Event('quizary:auth-cleared'))
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status !== 401) return Promise.reject(err)
    // Token basi/invalid → selalu bersihkan agar PublicRoute tidak bounce
    // balik ke /q/... (loop login). Public pages handle 401 sendiri,
    // jadi jangan redirect dan hilangkan konteks form.
    clearStaleAuth()
    const path = window.location.pathname
    const isPublic = path.startsWith('/q/') || path.startsWith('/s/')
    const isAuth = path.includes('/login') || path.includes('/register') || path.includes('/otp')
    if (!isPublic && !isAuth) {
      const next = encodeURIComponent(path + window.location.search)
      window.location.href = `/login?next=${next}`
    }
    return Promise.reject(err)
  }
)

export default api
