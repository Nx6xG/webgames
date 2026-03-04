'use client';

import type { RefObject } from 'react';
import type { OnlineUser } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';
import { OnlineUsersPanel } from './OnlineUsersPanel';

interface OnlineUsersDrawerProps {
  open: boolean;
  onClose: () => void;
  users: OnlineUser[];
  connected: boolean;
  myToken: string;
  onInvite?: (token: string, nickname: string) => void;
  /** Ref forwarded from the parent so useClickOutside can treat the panel as "inside". */
  panelRef?: RefObject<HTMLDivElement | null>;
}

export function OnlineUsersDrawer({ open, onClose, users, connected, myToken, onInvite, panelRef }: OnlineUsersDrawerProps) {
  const { t } = useI18n();
  // Escape + click-outside are handled by the parent (OnlineNavChip) via
  // useEscape / useClickOutside so we avoid the stale-closure trap of an
  // inline useEffect that depends on the recreated `onClose` function.

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — ref is forwarded to the parent for useClickOutside containment */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-dvh w-[340px] max-w-full flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-800 shrink-0">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`}
            aria-hidden
          />
          <span className="font-semibold text-sm text-zinc-100 flex-1">{t('online.title')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 tabular-nums font-medium">
            {users.length}
          </span>
          <button
            onClick={onClose}
            className="ml-1 text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <OnlineUsersPanel users={users} myToken={myToken} variant="drawer" onInvite={onInvite} />
        </div>
      </div>
    </>
  );
}
