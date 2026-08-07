'use client';

import { useState, useEffect, useRef } from 'react';
import { getGlobalVolume, setGlobalVolume as persistVolume } from '@/lib/globalMute';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useClickOutside, useEscape } from '@/hooks/useClickOutside';

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

  // The popup opens on hover but must also close reliably on touch devices
  // and when the pointer never enters the popup itself.
  useClickOutside(containerRef, () => setOpen(false), open);
  useEscape(() => setOpen(false), open);

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
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={toggleMute}
        className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none p-1"
        title={muted ? t('game.sound.unmute') : t('game.sound.mute')}
        aria-label={muted ? t('game.sound.unmute') : t('game.sound.mute')}
      >
        {icon}
      </button>
      {open && (
        // pt-2 (padding, not margin) bridges the gap between button and panel so
        // the pointer never leaves the container while moving onto the slider.
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 pt-2">
          <div
            className="p-3 rounded-lg border shadow-xl flex flex-col items-center"
            style={{
              backgroundColor: 'var(--card, #27272a)',
              borderColor: 'var(--border, #3f3f46)',
            }}
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
        </div>
      )}
    </div>
  );
}
