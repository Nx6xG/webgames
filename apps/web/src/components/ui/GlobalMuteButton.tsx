'use client';

import { useCallback, useEffect, useState } from 'react';
import { isGloballyMuted, setGlobalMuted } from '@/lib/globalMute';
import { useI18n } from '@/components/providers/LanguageProvider';

export function GlobalMuteButton() {
  const { t } = useI18n();
  const [muted, setMuted] = useState(false);

  useEffect(() => { setMuted(isGloballyMuted()); }, []);

  const toggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setGlobalMuted(next);
      return next;
    });
  }, []);

  return (
    <button
      onClick={toggle}
      className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none"
      title={muted ? t('game.sound.unmute') : t('game.sound.mute')}
      aria-label={muted ? t('game.sound.unmute') : t('game.sound.mute')}
    >
      {muted ? '\u{1F507}' : '\u{1F50A}'}
    </button>
  );
}
