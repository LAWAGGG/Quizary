const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|aac|webm|flac)(\?.*)?$/i;
const AUDIO_MIME_HINT = ['audio/', 'mp3', 'wav', 'm4a', 'ogg'];

export function isAudioUrl(url?: string | null): boolean {
  if (!url) return false;
  return AUDIO_EXT.test(url) || AUDIO_MIME_HINT.some((k) => url.toLowerCase().includes(k));
}

export function extractMediaUrl(item: any, htmlText?: string): string | null {
  if (!item && !htmlText) return null;
  const rawProp =
    item?.image?.path ||
    item?.image?.url ||
    (typeof item?.image === 'string' ? item.image : null) ||
    item?.image_path ||
    item?.image_url ||
    item?.imageUrl ||
    item?.media ||
    item?.audio ||
    item?.audio_path ||
    item?.question_image;

  let urlStr = typeof rawProp === 'string' ? rawProp : null;
  if (!urlStr && htmlText) {
    const m = htmlText.match(/<(audio|source)[^>]+src=["']([^"']+)["']/i);
    if (m && m[2]) urlStr = m[2];
    else {
      const m2 = htmlText.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m2 && m2[1]) urlStr = m2[1];
    }
  }
  if (!urlStr) return null;
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:')) return urlStr;
  // also handle uploaded paths like uploads/question-images/xxx.mp3
  const { BASE_URL } = require('../services/api_service');
  const rootHost = (BASE_URL as string).replace(/\/api\/?$/, '');
  const cleanPath = urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
  return `${rootHost}${cleanPath}`;
}

function resolveUrl(urlStr: string | null): string | null {
  if (!urlStr) return null;
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:')) return urlStr;
  const { BASE_URL } = require('../services/api_service');
  const rootHost = (BASE_URL as string).replace(/\/api\/?$/, '');
  const cleanPath = urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
  return `${rootHost}${cleanPath}`;
}

export function getQuestionImageUrl(q: any): string | null {
  // prioritas: q.image (jika bukan audio) -> html <img>
  const p = q?.image?.path || (typeof q?.image === 'string' ? q.image : null);
  if (p && !isAudioUrl(p)) return resolveUrl(p);
  if (q?.question_text) {
    const m = String(q.question_text).match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1] && !isAudioUrl(m[1])) return resolveUrl(m[1]);
  }
  // fallback: cari di q.images array
  if (Array.isArray(q?.images)) {
    const img = q.images.find((im: any) => !isAudioUrl(im.path));
    if (img?.path) return resolveUrl(img.path);
  }
  return null;
}

export function getQuestionAudioUrl(q: any): string | null {
  // prioritas: q.audio -> q.image jika audio -> html <audio>/<source>
  const a = q?.audio?.path || (typeof q?.audio === 'string' ? q.audio : null);
  if (a) return resolveUrl(a);
  const p = q?.image?.path || (typeof q?.image === 'string' ? q.image : null);
  if (p && isAudioUrl(p)) return resolveUrl(p);
  if (q?.question_text) {
    const m = String(q.question_text).match(/<(audio|source)[^>]+src=["']([^"']+)["']/i);
    if (m && m[2]) return resolveUrl(m[2]);
  }
  if (Array.isArray(q?.images)) {
    const aud = q.images.find((im: any) => isAudioUrl(im.path));
    if (aud?.path) return resolveUrl(aud.path);
  }
  return null;
}
