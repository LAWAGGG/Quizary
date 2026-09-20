/**
 * serverClock — jam acuan anti-curang untuk semua countdown ujian di Android.
 *
 * Masalah: countdown yang dihitung dari `Date.now()` ikut jam HP — responden
 * bisa memundurkan jam device untuk menambah waktu ujian, menunda lock 5 detik,
 * atau mengacaukan hitung mundur 5 menit auto-finalize.
 *
 * Solusi (sama seperti `useServerClock` di web): setiap respons API membawa
 * `server_now` (jam server WIB). Modul ini menyimpan anchor
 * { serverMs, monoMs, wallMs } lalu:
 *   serverNowMs() = serverMs + (monoNow() - monoMs)
 * `monoNow()` memakai `performance.now()` (Hermes) yang monotonik — tidak
 * terpengaruh perubahan jam sistem. Bila `performance.now()` tidak tersedia
 * di runtime ini (fallback ke `Date.now()`), nilai yang dipublikasikan
 * di-CLAMP supaya tidak pernah turun — memundurkan jam HP tetap tidak bisa
 * menggeser countdown ke belakang sama sekali.
 *
 * Kenapa bukan library NTP (TrueTime/Kronos)?
 * - Butuh native module + rebuild + koneksi ke pool.ntp.org (sering diblokir
 *   jaringan sekolah) — padahal backend SUDAH mengirim server_now di setiap
 *   respons penting (create/resume/detail/autosave/start).
 * - Sinkron ke backend sendiri lebih tepat untuk deadline KITA (tanpa selisih
 *   NTP-vs-server) dan tetap akurat offline via elapsed monotonik.
 * Validasi utama tetap di backend (expiry dicek server-side tiap request +
 * sweep locked->cheating 5 menit); modul ini menjaga UX countdown jujur.
 */

let anchorServerMs = 0;
let anchorMonoMs = 0;
let anchorWallMs = 0;
let synced = false;

/**
 * Nilai monotonik terakhir yang dipublikasikan + sumbernya.
 * Clamp ini yang menutup bug timer: kalaupun `performance.now()` tidak ada
 * dan kita fallback ke `Date.now()`, jam yang dipakai countdown TIDAK PERNAH
 * mundur mengikuti jam device.
 */
let lastMono = 0;
let monoSource: 'perf' | 'wall' | null = null;

/** Jam monotonik device (ms). Tidak pernah turun antar panggilan. */
export function monoNow(): number {
  let v: number | undefined;
  let src: 'perf' | 'wall' = 'wall';
  try {
    const p = (globalThis as any).performance;
    if (p && typeof p.now === 'function') {
      const x = p.now();
      if (typeof x === 'number' && isFinite(x)) {
        v = x;
        src = 'perf';
      }
    }
  } catch {}
  if (v === undefined) {
    v = Date.now();
    src = 'wall';
  }
  // Reset clamp saat domain sumber berganti (praktisnya statis per runtime;
  // preventif supaya tidak freeze selamanya bila domain berganti).
  if (monoSource !== null && src !== monoSource) {
    lastMono = v;
  } else if (v > lastMono) {
    lastMono = v;
  }
  monoSource = src;
  return lastMono;
}

/**
 * Parse waktu server ke epoch ms. Format utama backend: "d-m-Y H:i:s" WIB
 * (contoh "24-07-2026 17:10:00"). Menerima juga "Y-m-d H:i:s" (WIB), ISO,
 * epoch number, dan Date.
 */
export function parseServerTime(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) {
    const t = v.getTime();
    return isNaN(t) ? null : t;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;

  // "DD-MM-YYYY HH:mm:ss" WIB
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 7, +m[5], +(m[6] ?? 0));
  }
  // "YYYY-MM-DD HH:mm:ss" WIB (tanpa T/Z = zona server)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5], +(m[6] ?? 0));
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}

/** Jangkar ulang ke jam server. Dipanggil tiap respons API ada `server_now`. */
export function syncServerClock(serverNow: unknown): boolean {
  const ms = parseServerTime(serverNow);
  if (ms == null) return false;
  anchorServerMs = ms;
  anchorMonoMs = monoNow();
  anchorWallMs = Date.now();
  synced = true;
  return true;
}

export function isServerClockSynced(): boolean {
  return synced;
}

/** mono timestamp anchor terakhir (untuk mengukur kebasian sync). */
export function lastSyncMonoMs(): number {
  return synced ? anchorMonoMs : 0;
}

/** Jam server saat ini (ms epoch). Aman dari ubahan jam HP setelah sync. */
export function serverNowMs(): number {
  if (!synced) return Date.now();
  return anchorServerMs + (monoNow() - anchorMonoMs);
}

/**
 * Selisih jam dinding device vs ekspektasi monotonik sejak anchor.
 * > 0 = jam dimajukan, < 0 = jam dimundurkan (mis. -3600000 = mundur 1 jam).
 * Dipakai untuk deteksi manipulasi jam.
 */
export function wallClockJumpMs(): number {
  if (!synced) return 0;
  const expectedWall = anchorWallMs + (monoNow() - anchorMonoMs);
  return Date.now() - expectedWall;
}
