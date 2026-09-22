import { useEffect, useState } from 'react';
import { getPublicForm } from '../services/api_service';

const richTitleCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function devLog(...args: any[]) {
  try {
    if ((globalThis as any).__DEV__) console.log('[RichTitle]', ...args);
  } catch {}
}

/**
 * Fetches the rich (HTML) title of a public form from GET /q/{shortCode},
 * deduped per short_code so every card subscribed to the same form gets the
 * result (not just the first one that started the request).
 */
function fetchRichTitle(code: string): Promise<string> {
  const cached = richTitleCache.get(code);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inFlight.get(code);
  if (existing) return existing;

  devLog('fetch', code);
  const p = getPublicForm(code)
    .then((f: any) => {
      const title = f?.title ? String(f.title) : '';
      richTitleCache.set(code, title);
      inFlight.delete(code);
      devLog('fetched', code, title ? title.slice(0, 100) : '(empty)');
      return title;
    })
    .catch((e: any) => {
      richTitleCache.set(code, '');
      inFlight.delete(code);
      devLog('failed', code, String((e && e.message) || e));
      return '';
    });
  inFlight.set(code, p);
  return p;
}

/**
 * Returns the rich (HTML) title of a public form. Needed because
 * GET /me/submissions strips all HTML tags from form_title — formulas sent to
 * the list are no longer renderable.
 *
 * Results are cached per short_code (and in-flight requests are shared across
 * callers), so a submissions list doesn't re-hit the network nor leave sibling
 * cards stuck: when the fetch resolves, every subscribed card updates.
 * Returns null until resolved (or when the form is unreachable — in that case
 * the caller falls back to the stripped title).
 */
export function useRichFormTitle(shortCode?: string | null): string | null {
  const [richTitle, setRichTitle] = useState<string | null>(() =>
    shortCode ? (richTitleCache.get(shortCode) || null) : null
  );

  useEffect(() => {
    const code = shortCode || null;
    if (!code) return;
    let cancelled = false;
    fetchRichTitle(code).then((title) => {
      if (!cancelled && title) setRichTitle(title);
    });
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  return richTitle;
}