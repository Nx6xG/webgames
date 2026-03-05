'use client';

import { useEffect } from 'react';
import type { ChatMessage, ChatScope } from 'shared';
import { ChatPanelWithProfile as ChatPanel } from './ChatPanelWithProfile';

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  globalMessages: ChatMessage[];
  chatError: string | null;
  onSend: (scope: ChatScope, message: string) => void;
}

export function ChatDrawer({
  open,
  onClose,
  title = 'Global Chat',
  globalMessages,
  chatError,
  onSend,
}: ChatDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[360px] max-w-full flex flex-col bg-zinc-900 border-l border-zinc-800 shadow-2xl transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <span className="font-semibold text-sm text-zinc-100">{title}</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded"
            aria-label="Close chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat panel fills remaining height */}
        <ChatPanel
          mode="global"
          roomCode={null}
          roomMessages={[]}
          globalMessages={globalMessages}
          chatError={chatError}
          onSend={onSend}
          className="flex-1 min-h-0"
        />
      </div>
    </>
  );
}
