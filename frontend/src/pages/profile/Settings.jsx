import { useTranslation } from 'react-i18next'
import { Monitor, Sun, Moon, Type, Languages, Sparkles, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { Card, PageHeader, Select, Toggle } from '../../components/ui'
import { usePrefs } from '../../context/PreferencesContext'
import { useToast } from '../../hooks/useToast'
import { persistLang } from '../../lib/i18n.js'

function Row({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-gray-100">{title}</p>
          {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { theme, fontSize, reduceMotion, setPref } = usePrefs()
  const toast = useToast()

  const changeLang = (lng) => {
    i18n.changeLanguage(lng)
    persistLang(lng)
    toast.success(t('settings.languageChanged'))
  }

  const clearSessions = () => {
    localStorage.removeItem('quizary_session_tokens')
    toast.success(t('settings.sessionsCleared'))
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-5">
          <h2 className="font-display font-semibold text-ink dark:text-gray-100 mb-2 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-primary" />
            {t('settings.appearance')}
          </h2>
          <Row icon={Monitor} title={t('settings.theme')} desc={t('settings.themeDesc')}>
            <Select
              value={theme}
              onChange={(e) => setPref('theme', e.target.value)}
              aria-label={t('settings.theme')}
              className="w-36 !h-9 !text-sm"
            >
              <option value="light">{t('settings.light')}</option>
              <option value="dark">{t('settings.dark')}</option>
              <option value="system">{t('settings.system')}</option>
            </Select>
          </Row>
          <Row icon={Type} title={t('settings.fontSize')} desc={t('settings.fontSizeDesc')}>
            <Select
              value={fontSize}
              onChange={(e) => setPref('fontSize', e.target.value)}
              aria-label={t('settings.fontSize')}
              className="w-36 !h-9 !text-sm"
            >
              <option value="sm">{t('settings.small')}</option>
              <option value="md">{t('settings.normal')}</option>
              <option value="lg">{t('settings.large')}</option>
            </Select>
          </Row>
          <Row icon={Sparkles} title={t('settings.reduceMotion')} desc={t('settings.reduceMotionDesc')}>
            <Toggle
              label={t('settings.reduceMotion')}
              checked={reduceMotion}
              onChange={(v) => setPref('reduceMotion', v)}
            />
          </Row>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold text-ink dark:text-gray-100 mb-2 flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            {t('settings.languageRegion')}
          </h2>
          <Row icon={Languages} title={t('settings.language')} desc={t('settings.languageDesc')}>
            <Select
              value={i18n.language?.startsWith('en') ? 'en' : 'id'}
              onChange={(e) => changeLang(e.target.value)}
              aria-label={t('settings.language')}
              className="w-36 !h-9 !text-sm"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </Select>
          </Row>

          <h2 className="font-display font-semibold text-ink dark:text-gray-100 mt-6 mb-2 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-primary" />
            {t('settings.privacy')}
          </h2>
          <Row icon={Trash2} title={t('settings.clearSessions')} desc={t('settings.clearSessionsDesc')}>
            <button
              onClick={clearSessions}
              className="h-9 px-3 rounded-xl text-sm font-semibold text-incorrect hover:bg-incorrect-soft active:scale-[0.98] transition-all"
            >
              {t('settings.clear')}
            </button>
          </Row>
        </Card>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 flex items-center gap-1.5">
        <Sun className="w-3.5 h-3.5" />
        {t('settings.savedHint')}
      </p>
    </div>
  )
}
