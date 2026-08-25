import { useState, useEffect, useCallback, createContext, useContext } from 'react'

const KEY = 'quizary-prefs'

const DEFAULTS = {
  theme: 'system',        // light | dark | system
  fontSize: 'md',         // sm | md | lg
  reduceMotion: false,
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { ...DEFAULTS }
  }
}

const PrefsContext = createContext(null)

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(load)
  const [dark, setDark] = useState(false)

  // Terapkan + persist setiap perubahan.
  useEffect(() => {
    const root = document.documentElement
    const isDark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setDark(isDark)
    root.classList.toggle('dark', isDark)
    root.style.fontSize = { sm: '87.5%', md: '100%', lg: '112.5%' }[prefs.fontSize] || '100%'
    root.classList.toggle('reduce-motion', prefs.reduceMotion)
    localStorage.setItem(KEY, JSON.stringify(prefs))
  }, [prefs])

  // Ikuti perubahan OS saat mode system.
  useEffect(() => {
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      document.documentElement.classList.toggle('dark', e.matches)
      setDark(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs.theme])

  const setPref = useCallback((key, value) => setPrefs((p) => ({ ...p, [key]: value })), [])

  return <PrefsContext.Provider value={{ ...prefs, dark, setPref }}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  return useContext(PrefsContext)
}
