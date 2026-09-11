import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function FormBackButton() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <button
      onClick={() => navigate('/forms')}
      className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-ink dark:hover:text-gray-100 transition-colors mb-4"
    >
      <ArrowLeft className="w-4 h-4" /> {t('formEdit.backToForms')}
    </button>
  )
}
