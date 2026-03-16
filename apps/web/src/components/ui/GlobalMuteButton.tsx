'use client';

import { useState, useEffect, useRef } from 'react';
import { getGlobalVolume, setGlobalVolume as persistVolume } from '@/lib/globalMute';
import { useI18n } from '@/components/providers/LanguageProvider';

export function GlobalMuteButton() {
  const { t } = useI18n();
  const [volume, setVolume] = useState(80);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Remember last non-zero volume so clicking the icon can toggle between 0 and previous. */
  const prevVolumeRef = useRef(80);

  useEffect(() => {
    const v = getGlobalVolume();
    setVolume(v);
    if (v > 0) prevVolumeRef.current = v;
  }, []);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    persistVolume(v);
    if (v > 0) prevVolumeRef.current = v;
  };

  const toggleMute = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      handleVolumeChange(0);
    } else {
      handleVolumeChange(prevVolumeRef.current || 80);
    }
  };

  const muted = volume === 0;
  const icon = muted ? '\u{1F507}' : volume < 50 ? '\u{1F509}' : '\u{1F50A}';

  return (
    <div className="relative" ref={containerRef}>
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
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 rounded-lg border shadow-xl flex flex-col items-center z-50"
          style={{
            backgroundColor: 'var(--card, #27272a)',
            borderColor: 'var(--border, #3f3f46)',
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="accent-indigo-500"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px' }}
            aria-label={t('game.sound.volume')}
          />
          <div className="text-xs text-center mt-1" style={{ color: 'var(--fg-muted, #a1a1aa)' }}>
            {volume}%
          </div>
        </div>
      )}
    </div>
  );
}
