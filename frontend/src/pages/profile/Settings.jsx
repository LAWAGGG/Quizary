import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Sun, Moon, Type, Languages, Settings as SettingsIcon, LogOut, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader, Button } from '../../components/ui'
import { usePrefs } from '../../context/PreferencesContext'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'
import { persistLang } from '../../lib/i18n.js'

function ChoiceCard({ active, onClick, icon, label, sublabel, flag }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-4 sm:p-5 text-center transition-all duration-150 active:scale-[0.98] ${
        active
          ? 'border-primary bg-primary-50 dark:bg-primary-900/20 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-ink-800 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-ink-700/50'
      }`}
    >
      {active && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary text-white grid place-items-center shadow-sm">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
      {flag ? (
        <span className="text-[26px] leading-none" aria-hidden="true">
          {flag}
        </span>
      ) : (
        <span className={`leading-none ${active ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>{icon}</span>
      )}
      <span
        className={`text-xs sm:text-sm font-semibold leading-none ${active ? 'text-primary dark:text-primary-300' : 'text-ink dark:text-gray-100'}`}
      >
        {label}
      </span>
      {sublabel && (
        <span className="text-[11px] leading-none text-gray-400 dark:text-gray-500">{sublabel}</span>
      )}
    </button>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { theme, fontSize, setPref } = usePrefs()
  const toast = useToast()
  const { logout } = useAuth()
  const navigate = useNavigate()

  // Debounce slider agar tidak langsung commit tiap pixel saat drag.
  const sizeMap = { sm: 0, md: 1, lg: 2 }
  const sizeArr = ['sm', 'md', 'lg']
  const [sliderVal, setSliderVal] = useState(() => sizeMap[fontSize] ?? 1)
  const debounceRef = useRef(null)

  useEffect(() => {
    setSliderVal(sizeMap[fontSize] ?? 1)
  }, [fontSize])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const handleSliderChange = (e) => {
    const v = Number(e.target.value)
    setSliderVal(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setPref('fontSize', sizeArr[v] ?? 'md'), 300)
  }

  const handleSliderCommit = () => {
    clearTimeout(debounceRef.current)
    setPref('fontSize', sizeArr[sliderVal] ?? 'md')
  }

  const changeLang = (lng) => {
    i18n.changeLanguage(lng)
    persistLang(lng)
    toast.success(t('settings.languageChanged'))
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
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
          <h2 className="font-display font-semibold text-ink dark:text-gray-100 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-primary" />
            {t('settings.appearance')}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('settings.appearanceDesc')}</p>

          <div className="mt-5">
            <p className="text-sm font-semibold text-ink dark:text-gray-100 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gray-400" />
              {t('settings.theme')}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
              <ChoiceCard
                active={theme === 'light'}
                onClick={() => setPref('theme', 'light')}
                icon={<Sun className="w-4 h-4" />}
                label={t('settings.light')}
              />
              <ChoiceCard
                active={theme === 'dark'}
                onClick={() => setPref('theme', 'dark')}
                icon={<Moon className="w-4 h-4" />}
                label={t('settings.dark')}
              />
              <ChoiceCard
                active={theme === 'system'}
                onClick={() => setPref('theme', 'system')}
                icon={<Monitor className="w-4 h-4" />}
                label={t('settings.system')}
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-ink dark:text-gray-100 flex items-center gap-2">
              <Type className="w-4 h-4 text-gray-400" />
              {t('settings.fontSize')}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-ink-800 text-gray-500 dark:text-gray-400 grid place-items-center shrink-0"
                aria-hidden="true"
              >
                <span className="font-display font-bold text-[11px] leading-none tracking-tight">Tt</span>
              </span>
              <div className="flex-1 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={sliderVal}
                  onChange={handleSliderChange}
                  onPointerUp={handleSliderCommit}
                  onTouchEnd={handleSliderCommit}
                  onKeyUp={handleSliderCommit}
                  aria-label={t('settings.fontSize')}
                  className="w-full h-2 bg-gray-200 dark:bg-ink-700 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-1.5 px-0.5">
                  {[
                    { key: 'sm', label: t('settings.small') },
                    { key: 'md', label: t('settings.normal') },
                    { key: 'lg', label: t('settings.large') },
                  ].map((o) => (
                    <span
                      key={o.key}
                      className={`text-[11px] leading-none ${sizeArr[sliderVal] === o.key ? 'text-primary font-semibold' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      {o.label}
                    </span>
                  ))}
                </div>
              </div>
              <span
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-ink-800 text-gray-500 dark:text-gray-400 grid place-items-center shrink-0"
                aria-hidden="true"
              >
                <span className="font-display font-bold text-[16px] leading-none tracking-tight">Tt</span>
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold text-ink dark:text-gray-100 flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            {t('settings.languageRegion')}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('settings.languageDesc')}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <ChoiceCard
              active={!(i18n.language?.startsWith('en'))}
              onClick={() => changeLang('id')}
              flag="🇮🇩"
              label="Indonesia"
              sublabel="Bahasa Indonesia"
            />
            <ChoiceCard
              active={i18n.language?.startsWith('en')}
              onClick={() => changeLang('en')}
              flag="🇬🇧"
              label="English"
              sublabel="English"
            />
          </div>
        </Card>
      </div>

      <div className="mt-6 lg:hidden">
        <Card className="p-5">
          <Button
            variant="ghost-danger"
            className="w-full"
            icon={<LogOut className="w-4 h-4" />}
            onClick={handleLogout}
          >
            {t('auth.logout')}
          </Button>
        </Card>
      </div>
    </div>
  )
}
