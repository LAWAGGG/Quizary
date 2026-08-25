import { useRef } from 'react'

/**
 * useHoldSelect — UX mobile untuk seleksi kartu: tahan (hold) kartu untuk
 * memilihnya, lengkap dengan getaran haptic. Saat mode seleksi aktif (ada
 * kartu terpilih), tap biasa pada kartu lain langsung men-toggle seleksi —
 * tidak perlu hold lagi. Desktop tetap pakai checkbox; hook ini untuk sentuhan.
 *
 * Dipakai: <div {...holdProps}> — onContextMenu dicegah agar long-press mobile
 * tidak membuka menu konteks/text selection.
 */
export function useHoldSelect({ selectedCount, onToggle, onTap, holdMs = 450 }) {
  const timer = useRef(null)
  const suppressClick = useRef(false)

  const clear = () => {
    clearTimeout(timer.current)
    timer.current = null
  }

  const start = () => {
    clear()
    timer.current = setTimeout(() => {
      suppressClick.current = true
      if (navigator.vibrate) navigator.vibrate(40)
      onToggle()
    }, holdMs)
  }

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      if (selectedCount > 0) {
        onToggle()
        return
      }
      onTap?.()
    },
  }
}
