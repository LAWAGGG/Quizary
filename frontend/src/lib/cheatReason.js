// ponytail: single source untuk label pelanggaran — raw codes dari backend/frontend -> friendly i18n
const REASON_KEY_MAP = {
  'left-fullscreen': 'violation.leftFullscreen',
  'tab-hidden': 'violation.tabHidden',
  'window-blur': 'violation.windowBlur',
  'split-screen': 'violation.splitScreen',
  // legacy / block-only (muncul di data lama)
  'print': 'violation.blockedAction',
  'picture-in-picture': 'violation.blockedAction',
  'context-menu': 'violation.blockedAction',
  'copy': 'violation.blockedAction',
  'shortcut': 'violation.blockedAction',
  // backend fallback
  'Keluar dari aplikasi (App background/inactive)': 'violation.appBackground',
}

export function formatCheatReason(raw, t) {
  if (!raw || !String(raw).trim()) return t ? t('violation.unknown') : 'Aktivitas mencurigakan'
  const parts = String(raw).split(';').map((s) => s.trim()).filter(Boolean)
  const labels = parts.map((p) => {
    const key = REASON_KEY_MAP[p]
    if (key && t) return t(key)
    if (key && !t) return p
    // unknown fallback: biarkan raw tapi capitalisasi manusiawi
    return p
  })
  // dedup
  return [...new Set(labels)].join(', ')
}

export function formatCheatReasonDesc(raw, t) {
  // optional longer desc untuk tooltip — saat ini reuse same label
  return formatCheatReason(raw, t)
}
