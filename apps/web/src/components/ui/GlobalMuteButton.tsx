'use client';

import { useState, useEffect } from 'react';
import { getGlobalVolume, setGlobalVolume as setGlobalVolumeStorage, isGloballyMuted, setGlobalMuted } from '@/lib/globalMute';
import { useI18n } from '@/components/providers/LanguageProvider';

export function GlobalMuteButton() {
  const { t } = useI18n();
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMuted(isGloballyMuted());
    setVolume(getGlobalVolume());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setGlobalMuted(next);
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    setGlobalVolumeStorage(v);
    if (v > 0 && muted) {
      setMuted(false);
      setGlobalMuted(false);
    }
  };

  const icon = muted || volume === 0 ? '\u{1F507}' : volume < 50 ? '\u{1F509}' : '\u{1F50A}';

  return (
    <div className="relative">
      <button
        onClick={toggleMute}
        onMouseEnter={() => setOpen(true)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none p-1"
        title={muted ? t('game.sound.unmute') : t('game.sound.mute')}
        aria-label={muted ? t('game.sound.unmute') : t('game.sound.mute')}
      >
        {icon}
      </button>
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl flex flex-col items-center z-50"
          onMouseLeave={() => setOpen(false)}
        >
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            className="accent-indigo-500"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px' }}
          />
          <div className="text-xs text-center text-zinc-400 mt-1">{muted ? 0 : volume}%</div>
        </div>
      )}
    </div>
  );
}
