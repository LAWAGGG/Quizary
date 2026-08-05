import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, ClipboardList, ListChecks, UserRound, X, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { AppMark } from '../ui'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/forms', label: 'Forms', icon: ClipboardList, end: false },
  { to: '/my-submissions', label: 'My Submissions', icon: ListChecks, end: false },
  { to: '/profile', label: 'Profile', icon: UserRound, end: false },
]

function Sidebar({ open, onClose, onLogout, user }) {
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-white border-r border-gray-200 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-gray-100">
          <AppMark size="sm" />
          <div className="min-w-0">
            <p className="font-display font-bold leading-none text-ink">Quizary</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">Form &amp; Quiz Studio</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 -mr-2 rounded-xl text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Menu</p>
          {nav.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onClose}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-ink hover:bg-gray-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute left-0 top-1/3 -translate-y-1/2 w-1 h-5 rounded-full bg-primary"
                    />
                  )}
                  <link.icon className="w-[18px] h-[18px] shrink-0" />
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="px-3.5 py-3 rounded-xl bg-gray-50">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Logged in as</p>
            <p className="text-sm font-medium text-ink truncate mt-1">{user?.name || 'User'}</p>
            <button
              onClick={() => { onClose(); onLogout() }}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-incorrect text-xs font-semibold hover:bg-incorrect-soft transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-dvh bg-paper">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-ink hover:bg-gray-100 transition-colors lg:hidden"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-500 truncate">
                {user?.name ? `${user.name.split(' ')[0]}'s workspace` : 'Workspace'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label="User menu"
                aria-expanded={dropdownOpen}
              >
                <span className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center text-sm font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                <span className="hidden sm:block text-sm font-medium text-ink">
                  {user?.name || 'User'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-gray-100 shadow-lift py-1.5 z-50"
                  >
                    <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                      <p className="text-sm font-semibold text-ink truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email || ''}</p>
                    </div>
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/profile') }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/my-submissions') }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      My Submissions
                    </button>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-incorrect hover:bg-incorrect-soft transition-colors inline-flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
