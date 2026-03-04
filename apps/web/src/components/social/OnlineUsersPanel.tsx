'use client';

import type { OnlineUser } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';

interface OnlineUsersPanelProps {
  users: OnlineUser[];
  myToken: string;
  /** 'card' wraps the list in a rounded card shell; 'drawer' renders the list bare. */
  variant?: 'card' | 'drawer';
  /** When provided, shows an invite button for each non-self user. */
  onInvite?: (token: string, nickname: string) => void;
}

export function OnlineUsersPanel({ users, myToken, variant = 'card', onInvite }: OnlineUsersPanelProps) {
  const { t } = useI18n();

  const list = (
    <>
      {users.length === 0 ? (
        <p className="text-xs text-zinc-600 py-1">{t('online.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const isMe = u.playerToken === myToken;
            return (
              <li key={u.playerToken} className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" aria-hidden />
                <span className={`text-sm truncate flex-1 min-w-0 ${isMe ? 'text-indigo-300 font-medium' : 'text-zinc-300'}`}>
                  {u.nickname}
                </span>
                {isMe ? (
                  <span className="shrink-0 text-xs text-zinc-600">{t('online.you')}</span>
                ) : onInvite ? (
                  <button
                    onClick={() => onInvite(u.playerToken, u.nickname)}
                    className="shrink-0 ml-auto px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition"
                  >
                    {t('invite.title')}
                  </button>
                ) : u.connections > 1 ? (
                  <span className="shrink-0 text-xs text-zinc-700 tabular-nums">×{u.connections}</span>
                ) : null}
              </li>
            );
          })}
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
