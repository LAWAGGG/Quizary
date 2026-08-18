import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Public pages (FormLanding / AnswerQuiz) handle 401 themselves (e.g.
    // require_login gate). Don't bounce them to /login and lose form context.
    const path = window.location.pathname
    const isPublic = path.startsWith('/q/') || path.startsWith('/s/')
    if (err.response?.status === 401 && !isPublic && !path.includes('/login')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
