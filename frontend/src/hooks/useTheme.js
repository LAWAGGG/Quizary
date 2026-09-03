import { useContext } from 'react'
import { ThemeContext } from '../context/ThemeContext'
import { PrefsContext } from '../context/PreferencesContext'

export function useTheme() {
  const themeCtx = useContext(ThemeContext)
  const prefs = useContext(PrefsContext)
  if (themeCtx) return themeCtx
  if (prefs) {
    return {
      theme: prefs.dark ? 'dark' : 'light',
      toggleTheme: () => prefs.setPref('theme', prefs.dark ? 'light' : 'dark'),
    }
  }
  return { theme: 'light', toggleTheme: () => {} }
}