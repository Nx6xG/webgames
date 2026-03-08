'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import type { PartyState } from 'shared';

const TOKEN_KEY = 'wg_player_token';

interface PartyPanelProps {
  open: boolean;
  party: PartyState;
  onClose: () => void;
  onLeave: () => void;
  onKick: (token: string) => void;
  onInvite: () => void;
}

export function PartyPanel({ open, party, onClose, onLeave, onKick, onInvite }: PartyPanelProps) {
  const { t } = useI18n();
  const myToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) ?? '' : '';
  const isHost = party.hostToken === myToken;

  return (
    <div
      className={`fixed top-[60px] right-4 z-50 w-[280px] rounded-xl border border-indigo-800/40 bg-zinc-950 shadow-2xl transition-all duration-150 origin-top-right ${
        open
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-95 pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-100">{t('party.title')}</span>
          <span className="text-[10px] text-zinc-500 tabular-nums">{party.members.length}/6</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded"
          aria-label="Close"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Members */}
      <div className="px-3 py-2.5 space-y-1.5">
        {party.members.map((member) => (
          <div key={member.token} className="flex items-center gap-2 py-0.5">
            <AvatarBubble
              avatarId={member.avatarId}
              cosmetics={member.cosmetics}
              size="sm"
            />
            <span
              className="text-sm font-medium text-zinc-200 flex-1 min-w-0 truncate"
              style={member.cosmetics?.nameColor ? { color: member.cosmetics.nameColor } : undefined}
            >
              {member.nickname}
            </span>
            {member.token === party.hostToken && (
              <span className="text-[10px] text-amber-400 font-semibold shrink-0">{t('party.host')}</span>
            )}
            {isHost && member.token !== myToken && (
              <button
                onClick={() => onKick(member.token)}
                className="text-zinc-600 hover:text-rose-400 transition-colors shrink-0 p-0.5"
                title={t('party.kick')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex gap-2 border-t border-zinc-800/60 pt-2.5">
        <button
          onClick={onInvite}
          className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-xs font-medium transition-colors"
        >
          + {t('party.invite')}
        </button>
        <button
          onClick={onLeave}
          className="py-1.5 px-3 rounded-lg text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
        >
          {isHost ? t('party.disband') : t('party.leave')}
        </button>
      </div>
    </div>
  );
}
