'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { OnlineUser } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { createPortal } from 'react-dom';

interface RoomInviteButtonProps {
  playerIndex: number | null;
  playerCount: number;
  maxPlayers: number;
  onlineUsers: OnlineUser[];
  onInvite: (toToken: string) => void;
  onRefreshUsers?: () => void;
  /** Nicknames of players already in the room (used to filter the list). */
  playerNicknames: string[];
}

export function RoomInviteButton({
  playerIndex,
  playerCount,
  maxPlayers,
  onlineUsers,
  onInvite,
  onRefreshUsers,
  playerNicknames,
}: RoomInviteButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const myToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('wg_player_token') ?? '';
  }, []);

  // Only host (player 0) sees the button, and only when room has space
  if (playerIndex !== 0 || playerCount >= maxPlayers) return null;

  const nickSet = new Set(playerNicknames);
  const filtered = onlineUsers.filter((u) => {
    if (u.playerToken === myToken) return false;
    if (nickSet.has(u.nickname)) return false;
    if (search && !u.nickname.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleOpen() {
    setOpen(true);
    setSearch('');
    setSentTo(null);
    onRefreshUsers?.();
  }

  function handleInvite(token: string) {
    onInvite(token);
    setSentTo(token);
    setTimeout(() => setSentTo(null), 2000);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full py-2 rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        {t('roomInvite.button')}
      </button>

      {open && <RoomInviteModal
        filtered={filtered}
        search={search}
        onSearch={setSearch}
        showSearch={onlineUsers.length > 8}
        sentTo={sentTo}
        onInvite={handleInvite}
        onClose={() => setOpen(false)}
        t={t}
      />}
    </>
  );
}

function RoomInviteModal({
  filtered,
  search,
  onSearch,
  showSearch,
  sentTo,
  onInvite,
  onClose,
  t,
}: {
  filtered: OnlineUser[];
  search: string;
  onSearch: (v: string) => void;
  showSearch: boolean;
  sentTo: string | null;
  onInvite: (token: string) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [handleEsc]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-zinc-200">{t('roomInvite.title')}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {showSearch && (
          <div className="px-4 pb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t('roomInvite.search')}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-600"
              autoFocus
            />
          </div>
        )}

        <div className="px-4 pb-4 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">{t('roomInvite.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((u) => (
                <li key={u.playerToken} className="flex items-center gap-2">
                  <AvatarBubble avatarId={u.avatarId} avatarFrame={u.avatarFrame} nickname={u.nickname} size="sm" className="shrink-0" cosmetics={u.cosmetics} />
                  <span className={`flex-1 min-w-0 text-sm truncate ${getNameColorClass(u.cosmetics?.nameColor ?? u.nameColor) || 'text-zinc-300'}`}>
                    {u.nickname}
                    {u.cosmetics?.badges?.slice(0, 3).map((id) => (
                      <BadgeIcon key={id} badgeId={id} size="sm" />
                    ))}
                  </span>
                  {sentTo === u.playerToken ? (
                    <span className="shrink-0 text-xs text-emerald-400 font-medium">{t('roomInvite.sent')}</span>
                  ) : (
                    <button
                      onClick={() => onInvite(u.playerToken)}
                      className="shrink-0 px-3 py-1 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-800 text-indigo-300 hover:bg-zinc-700 hover:border-indigo-600 transition"
                    >
                      {t('invite.title')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
