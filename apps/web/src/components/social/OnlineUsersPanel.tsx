'use client';

import { useEffect, useState } from 'react';
import type { OnlineUser, PresenceActivity, GameId } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';
import { AvatarBubble } from '@/components/ui/AvatarBubble';
import { getNameColorClass } from '@/lib/nameColors';
import { getCosmeticDef } from '@/lib/cosmetics';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { loadFriends, updateFriendNickname } from '@/lib/friends';

const GAME_DISPLAY_NAMES: Record<GameId, string> = {
  tictactoe: 'Tic Tac Toe',
  connect4: 'Connect 4',
  rps: 'Schere Stein Papier',
  chess: 'Schach',
  battleship: 'Schiffe Versenken',
  liarsbar: "Liar's Deck",
};

function ActivityLabel({ activity, t }: { activity?: PresenceActivity; t: (key: string) => string }) {
  if (!activity) return null;
  let text: string;
  switch (activity.kind) {
    case 'home':
      text = t('online.activity.home');
      break;
    case 'game':
      text = GAME_DISPLAY_NAMES[activity.gameId] ?? activity.gameId;
      break;
    case 'room':
      text = `${activity.roomCode} – ${GAME_DISPLAY_NAMES[activity.gameId] ?? activity.gameId}`;
      break;
  }
  return (
    <span className="block text-[11px] text-zinc-500 truncate leading-tight">{text}</span>
  );
}

interface OnlineUsersPanelProps {
  users: OnlineUser[];
  myToken: string;
  /** 'card' wraps the list in a rounded card shell; 'drawer' renders the list bare. */
  variant?: 'card' | 'drawer';
  /** When provided, shows an invite button for each non-self user (private rooms). */
  onInvite?: (token: string, nickname: string) => void;
  /** When provided, shows a join button for users in public rooms. */
  onJoinRoom?: (gameId: GameId, roomCode: string) => void;
  /** When provided, clicking a user's name/avatar opens their profile. */
  onViewProfile?: (user: OnlineUser) => void;
}

export function OnlineUsersPanel({ users, myToken, variant = 'card', onInvite, onJoinRoom, onViewProfile }: OnlineUsersPanelProps) {
  const { t } = useI18n();
  const [friendTokens, setFriendTokens] = useState<Set<string>>(new Set());

  useEffect(() => {
    const friends = loadFriends();
    setFriendTokens(new Set(friends.map((f) => f.token)));
    // Update nicknames for online friends
    for (const u of users) {
      if (friends.some((f) => f.token === u.playerToken)) {
        updateFriendNickname(u.playerToken, u.nickname);
      }
    }
  }, [users]);

  // Split into friends and others, keeping self out of friends section
  const onlineFriends = users.filter((u) => friendTokens.has(u.playerToken) && u.playerToken !== myToken);
  const others = users.filter((u) => !friendTokens.has(u.playerToken) || u.playerToken === myToken);

  const list = (
    <>
      {users.length === 0 ? (
        <p className="text-xs text-zinc-600 py-1">{t('online.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {/* Friends section */}
          {onlineFriends.length > 0 && (
            <>
              <li className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 pt-1">
                {t('friends.online')} ({onlineFriends.length})
              </li>
              {onlineFriends.map((u) => (
                <UserRow key={u.playerToken} u={u} myToken={myToken} t={t} isFriend onInvite={onInvite} onJoinRoom={onJoinRoom} onViewProfile={onViewProfile} />
              ))}
              <li className="border-b border-zinc-800 my-1" />
            </>
          )}
          {others.map((u) => (
            <UserRow key={u.playerToken} u={u} myToken={myToken} t={t} onInvite={onInvite} onJoinRoom={onJoinRoom} onViewProfile={onViewProfile} />
          ))}
        </ul>
      )}
    </>
  );

  if (variant === 'drawer') return list;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {t('online.title')}
        </span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 font-medium border border-emerald-800/60 tabular-nums">
          {users.length}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">{list}</div>
    </div>
  );
}

function UserRow({
  u, myToken, t, isFriend: isFrd, onInvite, onJoinRoom, onViewProfile,
}: {
  u: OnlineUser;
  myToken: string;
  t: (k: string) => string;
  isFriend?: boolean;
  onInvite?: (token: string, nickname: string) => void;
  onJoinRoom?: (gameId: GameId, roomCode: string) => void;
  onViewProfile?: (user: OnlineUser) => void;
}) {
  const isMe = u.playerToken === myToken;
  const act = u.activity;
  const publicRoom = act?.kind === 'room' && act.isPublic === true ? act : null;
  const clickable = !!onViewProfile;

  return (
    <li className="flex items-start gap-2 min-w-0">
      <button
        type="button"
        onClick={() => onViewProfile?.(u)}
        disabled={!clickable}
        className={`flex items-start gap-2 min-w-0 flex-1 text-left ${clickable ? 'cursor-pointer hover:bg-zinc-800/50 -mx-1 px-1 py-0.5 rounded-lg transition-colors' : ''}`}
      >
        <AvatarBubble avatarId={u.avatarId} avatarFrame={u.avatarFrame} nickname={u.nickname} size="sm" className="mt-0.5 shrink-0" cosmetics={u.cosmetics} />
        <div className="flex-1 min-w-0">
          <span className={`text-sm truncate block ${isMe ? 'text-indigo-300 font-medium' : (getNameColorClass(u.cosmetics?.nameColor ?? u.nameColor) || 'text-zinc-300')}`}>
            {u.nickname}
            {isFrd && <span className="ml-1 text-[10px] text-indigo-400">★</span>}
            {u.cosmetics?.badges?.slice(0, 3).map((id) => (
              <BadgeIcon key={id} badgeId={id} size="sm" />
            ))}
          </span>
          <ActivityLabel activity={u.activity} t={t} />
        </div>
      </button>
      {isMe ? (
        <span className="shrink-0 text-xs text-zinc-600 mt-0.5">{t('online.you')}</span>
      ) : publicRoom && onJoinRoom ? (
        <button
          onClick={() => onJoinRoom(publicRoom.gameId, publicRoom.roomCode)}
          className="shrink-0 ml-auto px-3 py-1 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-900/60 text-emerald-400 hover:bg-zinc-800 hover:border-emerald-600 transition"
        >
          {t('online.join')}
        </button>
      ) : onInvite ? (
        <button
          onClick={() => onInvite(u.playerToken, u.nickname)}
          className="shrink-0 ml-auto px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition"
        >
          {t('invite.title')}
        </button>
      ) : u.connections > 1 ? (
        <span className="shrink-0 text-xs text-zinc-700 tabular-nums mt-0.5">×{u.connections}</span>
      ) : null}
    </li>
  );
}
