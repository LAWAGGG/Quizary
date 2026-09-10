/**
 * Deteksi media audio vs gambar dari URL upload soal.
 * Upload soal menerima image ATAU audio — preview menyesuaikan dari ekstensi file.
 */
const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|aac|webm)(\?.*)?$/i

export function isAudioUrl(url) {
  return !!url && AUDIO_EXT.test(url)
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