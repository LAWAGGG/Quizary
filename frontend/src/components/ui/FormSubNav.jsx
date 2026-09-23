import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Settings, HelpCircle, ClipboardList, BarChart3 } from 'lucide-react'
import api from '../../api/client'
import { ConfirmModal } from './Modal'

const items = [
  { to: (id) => `/forms/${id}`, key: 'settings', icon: Settings, end: true },
  { to: (id) => `/forms/${id}/questions`, key: 'questions', icon: HelpCircle, end: false },
  { to: (id) => `/forms/${id}/results`, key: 'results', icon: ClipboardList, end: false, count: true },
  { to: (id) => `/forms/${id}/analytics`, key: 'analytics', icon: BarChart3, end: false },
]

export function FormSubNav({ formId, className = '', hasUnsavedChanges = false }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [total, setTotal] = useState(null)
  const [pendingPath, setPendingPath] = useState(null)

  useEffect(() => {
    let alive = true
    setTotal(null)
    api.get(`/forms/${formId}/results/count`)
      .then((res) => { if (alive) setTotal(res.data?.total ?? 0) })
      .catch(() => { if (alive) setTotal(null) })
    return () => { alive = false }
  }, [formId])

  return (
    <nav
      className={`inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-ink rounded-xl overflow-x-auto max-w-full ${className}`}
      aria-label="Form sections"
    >
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.to(formId)}
          end={item.end}
          onClick={(event) => {
            if (!hasUnsavedChanges) return
            event.preventDefault()
            setPendingPath(item.to(formId))
          }}
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? 'bg-white dark:bg-ink-800 text-primary shadow-chip' : 'text-gray-500 dark:text-gray-400 hover:text-ink dark:hover:text-gray-100 hover:bg-white/60 dark:hover:bg-ink-800'
            }`
          }
        >
          <item.icon className="w-4 h-4" />
          {t(`formTabs.${item.key}`)}
          {item.count && total !== null && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold tabular-nums">
              {total}
            </span>
          )}
        </NavLink>
      ))}
      <ConfirmModal
        show={!!pendingPath}
        title={t('formTabs.unsavedTitle')}
        message={t('formTabs.unsavedChanges')}
        confirmText={t('formTabs.leaveWithoutSaving')}
        variant="primary"
        onCancel={() => setPendingPath(null)}
        onConfirm={() => {
          const path = pendingPath
          setPendingPath(null)
          navigate(path)
        }}
      />
    </nav>
  )
}
