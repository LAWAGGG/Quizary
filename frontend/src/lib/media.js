/**
 * Deteksi media audio vs gambar dari URL upload soal.
 * Media soal pisah per-slot: `image` (gambar) + `audio` (opsional).
 * Helper *-fallback menjaga data lama (audio tersimpan di slot image).
 */
const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|aac|webm)(\?.*)?$/i

export function isAudioUrl(url) {
  return !!url && AUDIO_EXT.test(url)
}

export function questionImageUrl(q) {
  const p = q?.image?.path
  if (!p || isAudioUrl(p)) return null
  return p
}

export function questionAudioUrl(q) {
  if (q?.audio?.path) return q.audio.path
  const p = q?.image?.path
  if (p && isAudioUrl(p)) return p
  return null
}

export function answerImageUrl(a) {
  const u = a?.question_image
  if (!u || isAudioUrl(u)) return null
  return u
}

export function answerAudioUrl(a) {
  if (a?.question_audio) return a.question_audio
  const u = a?.question_image
  if (u && isAudioUrl(u)) return u
  return null
}

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '')

/**
 * Samakan origin request media (img/audio/file) di vite dev.
 * <img>/<audio> tidak bisa kirim header ngrok-skip-browser-warning, sehingga
 * request cross-origin ke tunnel ngrok dapat interstitial HTML → browser blokir
 * (OpaqueResponseBlocking). Rewrite ke path relatif same-origin agar lewat
 * proxy vite (lihat vite.config.js) yang menyuntik header skip server-side.
 * Prod (/dist, tanpa proxy): URL absolut dikembalikan apa adanya.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  if (import.meta.env.DEV && url.startsWith(API_ROOT)) {
    const path = url.slice(API_ROOT.length)
    return path.startsWith('/') ? path : `/${path}`
  }
  return url
}