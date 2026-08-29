import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, ClipboardList, ListChecks, UserRound, X, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { AppMark } from '../ui'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/forms', label: 'Forms', icon: ClipboardList, end: false },
  { to: '/my-submissions', label: 'Submissions', icon: ListChecks, end: false },
  { to: '/profile', label: 'Profile', icon: UserRound, end: false },
]

/* ── Mobile bottom nav ────────────────────────────────────── */
function BottomNav({ hidden }) {
  const location = useLocation()
  return (
    <nav className={`fixed bottom-0 inset-x-0 z-40 lg:hidden overflow-hidden transition-[max-height] duration-200 ease-in-out ${hidden ? 'max-h-0' : 'max-h-14'}`}>
      <div className="bg-white dark:bg-ink-900 border-t border-gray-200 dark:border-gray-700 h-14 flex items-center justify-around">
        {nav.map((link) => {
          const isActive = link.end
            ? location.pathname === link.to
            : location.pathname.startsWith(link.to)
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <link.icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{link.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

/* ── Desktop sidebar ──────────────────────────────────────── */
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
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-white dark:bg-ink-900 border-r border-gray-200 dark:border-gray-600 transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:h-full ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-gray-100 dark:border-gray-600">
          <AppMark size="sm" />
          <div className="min-w-0">
            <p className="font-display font-bold leading-none text-ink dark:text-gray-100">Quizary</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 -mr-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Menu</p>
          {nav.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onClose}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-ink-800'
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

        <div className="p-3 border-t border-gray-100 dark:border-gray-600">
          <div className="px-3.5 py-3 rounded-xl bg-gray-50 dark:bg-ink-800/50">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Logged in as</p>
            <p className="text-sm font-medium text-ink dark:text-gray-100 truncate mt-1">{user?.name || 'User'}</p>
            <button
              onClick={() => { onClose(); onLogout() }}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-incorrect text-xs font-semibold hover:bg-incorrect-soft transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

/* ── Layout ───────────────────────────────────────────────── */
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const mainRef = useRef(null)
  const [navHidden, setNavHidden] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Scroll-to-hide navbar (mobile only)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    let hideTimer = null
    let showTimer = null
    function onScroll() {
      const y = el.scrollTop
      const scrollable = el.scrollHeight - el.clientHeight
      // Don't toggle if content isn't meaningfully scrollable
      if (scrollable < 60) {
        setNavHidden(false)
        return
      }
      clearTimeout(hideTimer)
      clearTimeout(showTimer)
      if (y < 10) {
        setNavHidden(false)
      } else if (y > lastScrollY.current + 30) {
        // Debounce: wait 150ms after last scroll event before hiding
        hideTimer = setTimeout(() => setNavHidden(true), 150)
      } else if (y < lastScrollY.current - 30) {
        // Debounce: wait 150ms after last scroll event before showing
        showTimer = setTimeout(() => setNavHidden(false), 150)
      }
      lastScrollY.current = y
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(hideTimer)
      clearTimeout(showTimer)
    }
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-dvh bg-paper dark:bg-ink-950">
      {/* ═══ SIDEBAR: desktop only ═══ */}
      <div className="hidden lg:block lg:h-full">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} user={user} />
      </div>

      {/* ═══ MOBILE SIDEBAR OVERLAY ═══ */}
      <div className="lg:hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} user={user} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── NAVBAR ── */}
        {/* Desktop: static, no collapse. Mobile: max-h collapse on scroll. */}
        <div className={`shrink-0 overflow-hidden transition-[max-height] duration-200 ease-in-out lg:max-h-none ${navHidden ? 'max-h-0' : 'max-h-16'}`}>
          <div className="bg-white dark:bg-ink-900 border-b border-gray-200 dark:border-gray-600">
            <div className="h-14 px-4 flex items-center justify-between sm:h-16 sm:px-8">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile: logo */}
                <div className="lg:hidden">
                  <AppMark size="sm" />
                </div>
                {/* Desktop: workspace name */}
                <span className="hidden lg:inline text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {user?.name ? `${user.name.split(' ')[0]}'s workspace` : 'Workspace'}
                </span>
                {/* Mobile: page title */}
                <span className="lg:hidden text-sm font-semibold text-ink dark:text-gray-100 truncate">
                  {user?.name ? `${user.name.split(' ')[0]}'s workspace` : 'Workspace'}
                </span>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
                    aria-label="User menu"
                    aria-expanded={dropdownOpen}
                  >
                    <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary dark:text-primary-300 flex items-center justify-center text-sm font-bold overflow-hidden">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user?.name?.charAt(0)?.toUpperCase() || 'U'
                      )}
                    </span>
                  </button>
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-ink-900 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-lift py-1.5 z-50"
                      >
                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-600 mb-1">
                          <p className="text-sm font-semibold text-ink dark:text-gray-100 truncate">{user?.name || 'User'}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{user?.email || ''}</p>
                        </div>
                        <button
                          onClick={() => { setDropdownOpen(false); navigate('/profile') }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ink-800 transition-colors"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => { setDropdownOpen(false); navigate('/my-submissions') }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ink-800 transition-colors"
                        >
                          My Submissions
                        </button>
                        <hr className="my-1 border-gray-100 dark:border-gray-600" />
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 text-sm text-incorrect hover:bg-incorrect-soft transition-colors"
                        >
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-ink-800 transition-colors"
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <main ref={mainRef} className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom nav: mobile only, same hide/show as navbar */}
      <BottomNav hidden={navHidden} />
    </div>
  )
}
