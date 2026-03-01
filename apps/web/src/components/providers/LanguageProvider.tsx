'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Lang } from '@/i18n/messages';
import { messages } from '@/i18n/messages';
import { applyLangToHtml, getStoredLang, setStoredLang } from '@/i18n/lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'de',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');

  useEffect(() => {
    const stored = getStoredLang();
    setLangState(stored);
    applyLangToHtml(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setStoredLang(next);
    applyLangToHtml(next);
  }, []);

  const t = useCallback(
    (key: string): string => messages[lang][key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  return useContext(LanguageContext);
}
