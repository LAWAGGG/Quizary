import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import DashboardLayout from './components/layout/DashboardLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
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

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  )
}
