'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { MultiplayerState } from '@/hooks/useMultiplayer';

/**
 * Displays:
 * 1. A full-screen overlay when **your own** connection is lost (reconnecting).
 * 2. An amber banner when an **opponent** has dropped but the grace period is still running.
 *
 * Usage: `<ReconnectBanner mp={mp} />` — drop into any multiplayer game component.
 */
export function ReconnectBanner({ mp }: { mp: MultiplayerState }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(0);

  const { connection, opponentDisconnectedAt, opponentGracePeriodMs, disconnectedPlayerIndex, players, phase } = mp;

  // Countdown timer for opponent reconnect
  useEffect(() => {
    if (!opponentDisconnectedAt || !opponentGracePeriodMs) {
      setRemaining(0);
      return;
    }

    function tick() {
      const elapsed = Date.now() - opponentDisconnectedAt!;
      const left = Math.max(0, opponentGracePeriodMs - elapsed);
      setRemaining(Math.ceil(left / 1000));
    }

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [opponentDisconnectedAt, opponentGracePeriodMs]);

  // Only show during active gameplay (waiting/playing) — not in lobby or after game ends
  if (phase === 'lobby' || phase === 'ended') return null;

  // Own connection lost overlay
  if (connection === 'connecting' || connection === 'error') {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-yellow-500/30 bg-zinc-900/95 px-8 py-6 shadow-xl max-w-sm text-center">
          <div className="relative flex items-center justify-center w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-yellow-500/30 border-t-yellow-400 animate-spin" />
            <span className="text-xl">📡</span>
          </div>
          <p className="text-sm font-semibold text-yellow-400">
            {t('reconnect.ownLost')}
          </p>
          <p className="text-xs text-zinc-400">
            {t('reconnect.ownRetrying')}
          </p>
        </div>
      </div>
    );
  }

  // Opponent disconnected banner
  if (opponentDisconnectedAt && remaining > 0) {
    const oppNick = players.find((p) => p.index === disconnectedPlayerIndex)?.nickname;
    const name = oppNick || t('game.common.opponent');
    return (
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 backdrop-blur-sm">
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
        </div>
        <p className="text-sm text-amber-300">
          <span className="font-semibold">{name}</span>
          {' '}{t('reconnect.opponentLeft')}{' '}
          <span className="font-mono font-bold text-amber-200">{remaining}s</span>
        </p>
      </div>
    );
  }

  return null;
}
