import { NavLink } from 'react-router-dom'
import { Settings, HelpCircle, ClipboardList, BarChart3 } from 'lucide-react'

const items = [
  { to: (id) => `/forms/${id}`, label: 'Settings', icon: Settings, end: true },
  { to: (id) => `/forms/${id}/questions`, label: 'Questions', icon: HelpCircle, end: false },
  { to: (id) => `/forms/${id}/results`, label: 'Results', icon: ClipboardList, end: false },
  { to: (id) => `/forms/${id}/analytics`, label: 'Analytics', icon: BarChart3, end: false },
]

export function FormSubNav({ formId, className = '' }) {
  return (
    <nav
      className={`inline-flex items-center gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto max-w-full ${className}`}
      aria-label="Form sections"
    >
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to(formId)}
          end={item.end}
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? 'bg-white text-primary shadow-chip' : 'text-gray-500 hover:text-ink hover:bg-white/60'
            }`
          }
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
