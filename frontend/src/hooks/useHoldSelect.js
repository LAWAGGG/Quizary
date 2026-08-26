import { useEffect, useRef } from 'react'

/**
 * useHoldSelect — UX mobile untuk seleksi kartu: tahan (hold) kartu untuk
 * memilihnya, lengkap dengan getaran haptic. Saat mode seleksi aktif (ada
 * kartu terpilih), tap biasa pada kartu lain langsung men-toggle seleksi —
 * tidak perlu hold lagi. Desktop tetap pakai checkbox; hook ini untuk sentuhan.
 *
 * Dipakai: <div {...holdProps}> — onContextMenu dicegah agar long-press mobile
 * tidak membuka menu konteks/text selection. Seleksi teks native juga diblokir
 * selama jari menempel (CSS select-none saja tidak cukup di semua kondisi
 * long-press Android/iOS), dan hold dibatalkan bila jari bergeser (mulai
 * scroll / drag dnd-kit).
 */
export function useHoldSelect({ selectedCount, onToggle, onTap, holdMs = 450 }) {
  const timer = useRef(null)
  const suppressClick = useRef(false)
  const pressing = useRef(false)
  const origin = useRef(null)

  useEffect(() => {
    // Blokir seleksi teks yang dicoba browser saat jari menempel
    const blockSelectStart = (e) => {
      if (pressing.current) e.preventDefault()
    }
    // Bersihkan seleksi yang sempat terbentuk (mis. dimulai sebelum blokir aktif)
    const clearSelection = () => {
      if (!pressing.current) return
      const sel = window.getSelection?.()
      if (sel && sel.rangeCount > 0) sel.removeAllRanges()
    }
    document.addEventListener('selectstart', blockSelectStart)
    document.addEventListener('selectionchange', clearSelection)
    return () => {
      document.removeEventListener('selectstart', blockSelectStart)
      document.removeEventListener('selectionchange', clearSelection)
    }
  }, [])

  const clear = () => {
    clearTimeout(timer.current)
    timer.current = null
  }

  const stopPressing = () => {
    pressing.current = false
    origin.current = null
    clear()
  }

  const start = (e) => {
    stopPressing()
    pressing.current = true
    origin.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 }
    timer.current = setTimeout(() => {
      suppressClick.current = true
      if (navigator.vibrate) navigator.vibrate(40)
      onToggle()
    }, holdMs)
  }

  // Jari bergeser >12px = mulai scroll / drag → batalkan hold agar kartu
  // tidak ikut terpilih di tengah geseran
  const move = (e) => {
    if (!pressing.current || !origin.current) return
    const dx = (e.clientX ?? 0) - origin.current.x
    const dy = (e.clientY ?? 0) - origin.current.y
    if (dx * dx + dy * dy > 144) stopPressing()
  }

  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: stopPressing,
    onPointerLeave: stopPressing,
    onPointerCancel: stopPressing,
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
