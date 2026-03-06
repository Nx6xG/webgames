'use client';

import { useI18n } from '@/components/providers/LanguageProvider';

interface SpectatorBannerProps {
  spectatorCount: number;
}

export function SpectatorBanner({ spectatorCount }: SpectatorBannerProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-amber-400/90 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-1.5">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="font-medium">{t('game.status.spectating')}</span>
      {spectatorCount > 1 && (
        <span className="text-amber-500/70 tabular-nums">({spectatorCount})</span>
      )}
    </div>
  );
}
