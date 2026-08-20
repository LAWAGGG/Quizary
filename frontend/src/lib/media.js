/**
 * Deteksi media audio vs gambar dari URL upload soal.
 * Upload soal menerima image ATAU audio — preview menyesuaikan dari ekstensi file.
 */
const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|aac|webm)(\?.*)?$/i

export function isAudioUrl(url) {
  return !!url && AUDIO_EXT.test(url)
}