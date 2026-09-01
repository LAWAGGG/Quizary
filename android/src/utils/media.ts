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
