import { useRef, useCallback } from 'react'

/**
 * useServerClock — jam acuan anti-curang untuk countdown ujian.
 *
 * Masalah: countdown yang dihitung dari `Date.now()` ikut jam device —
 * responden bisa memundurkan jam untuk menambah waktu.
 *
 * Solusi: setiap respons API membawa `server_now` (jam server WIB).
 * Hook ini menyimpan anchor { serverMs, performance.now() }, lalu
 * `serverNowMs()` = serverMs + elapsed monotonic. `performance.now()`
 * tidak terpengaruh perubahan jam sistem, jadi ubah jam device
 * mid-ujian tidak menggeser countdown.
 *
 * Resync: panggil `syncClock(ms)` tiap ada `server_now` baru
 * (load sesi, autosave sukses, refresh, focus/online).
 */
export function useServerClock() {
  const anchorRef = useRef({ serverMs: 0, perf: 0, synced: false })

  const syncClock = useCallback((serverMs) => {
    if (!serverMs || Number.isNaN(serverMs)) return
    anchorRef.current = { serverMs, perf: performance.now(), synced: true }
  }, [])

  const serverNowMs = useCallback(() => {
    const a = anchorRef.current
    if (!a.synced) return Date.now()
    return a.serverMs + (performance.now() - a.perf)
  }, [])

  return { syncClock, serverNowMs }
}
