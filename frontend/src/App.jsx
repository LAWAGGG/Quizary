import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { PreferencesProvider } from './context/PreferencesContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './hooks/useAuth'
import { ToastProvider } from './context/ToastContext.jsx'
import DashboardLayout from './components/layout/DashboardLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import VerifyOtp from './pages/auth/VerifyOtp'
import Dashboard from './pages/dashboard/Dashboard'
import FormList from './pages/forms/FormList'
import FormCreate from './pages/forms/FormCreate'
import FormEdit from './pages/forms/FormEdit'
import QuestionBuilder from './pages/forms/QuestionBuilder'
import FormLanding from './pages/public/FormLanding'
import AnswerQuiz from './pages/public/AnswerQuiz'
import QuizResult from './pages/public/QuizResult'
import Results from './pages/results/Results'
import Analytics from './pages/results/Analytics'
import Profile from './pages/profile/Profile'
import MySubmissions from './pages/profile/MySubmissions'
import Settings from './pages/profile/Settings'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    const from = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(from)}`} state={{ from }} replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user) {
    const from = location.state?.from || new URLSearchParams(location.search).get('next')
    // cegah loop jika from masih halaman auth
    const safe = from && !from.startsWith('/login') && !from.startsWith('/register') ? from : '/'
    return <Navigate to={safe} replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/otp" element={<VerifyOtp />} />
      <Route path="/q/:shortCode" element={<FormLanding />} />
      <Route path="/s/:submissionId" element={<AnswerQuiz />} />
      <Route path="/s/:submissionId/result" element={<QuizResult />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/forms" element={<FormList />} />
        <Route path="/forms/new" element={<FormCreate />} />
        <Route path="/forms/:formId" element={<FormEdit />} />
        <Route path="/forms/:formId/questions" element={<QuestionBuilder />} />
        <Route path="/forms/:formId/results" element={<Results />} />
        <Route path="/forms/:formId/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/my-submissions" element={<MySubmissions />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <PreferencesProvider>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </PreferencesProvider>
      </MotionConfig>
    </BrowserRouter>
  )
}
