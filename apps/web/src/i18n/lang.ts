import type { Lang } from './messages';

const LANG_KEY = 'webgames:lang';

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'de';
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'de';
}

export function setStoredLang(lang: Lang): void {
  localStorage.setItem(LANG_KEY, lang);
}

export function applyLangToHtml(lang: Lang): void {
  document.documentElement.lang = lang;
}
