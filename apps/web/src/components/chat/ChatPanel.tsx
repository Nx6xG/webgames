'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatScope } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export interface ChatPanelProps {
  mode: 'both' | 'room' | 'global';
  roomCode?: string | null;
  roomMessages: ChatMessage[];
  globalMessages: ChatMessage[];
  chatError: string | null;
  onSend: (scope: ChatScope, message: string) => void;
  className?: string;
  /** If true, renders a toggle header; content is hidden until the user expands */
  collapsible?: boolean;
  /** Initial open state when collapsible (default false) */
  defaultOpen?: boolean;
  /** Controlled open state (collapsible only) */
  open?: boolean;
  /** Called when the user toggles open/close (collapsible only) */
  onOpenChange?: (open: boolean) => void;
  /** Show a rose unread badge on the collapsed header */
  showUnreadBadge?: boolean;
  /**
   * @deprecated ChatPanel now tracks unread internally.
   * Kept for backward-compat; value is ignored.
   */
  unreadCount?: number;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function ChatPanel({
  mode,
  roomCode,
  roomMessages,
  globalMessages,
  chatError,
  onSend,
  className = '',
  collapsible = false,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  showUnreadBadge = false,
}: ChatPanelProps) {
  const { t } = useI18n();
  const [scope, setScope] = useState<ChatScope>(mode === 'global' ? 'global' : 'room');
  const [internalExpanded, setInternalExpanded] = useState(defaultOpen);
  const expanded = controlledOpen !== undefined ? controlledOpen : internalExpanded;

  function toggleExpanded() {
    const next = !expanded;
    setInternalExpanded(next);
    onOpenChange?.(next);
  }

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Internal unread tracking ───────────────────────────────────────────────
  // Tracked separately so both room AND global increases are counted,
  // regardless of which tab is currently active.
  const [internalUnread, setInternalUnread] = useState(0);
  const prevRoomCountRef = useRef<number | null>(null);
  const prevGlobalCountRef = useRef<number | null>(null);

  // Count new messages that arrive while the panel is collapsed.
  useEffect(() => {
    // First run: initialise refs without counting as unread.
    if (prevRoomCountRef.current === null || prevGlobalCountRef.current === null) {
      prevRoomCountRef.current = roomMessages.length;
      prevGlobalCountRef.current = globalMessages.length;
      return;
    }

    if (!expanded) {
      const roomDiff = roomMessages.length - prevRoomCountRef.current;
      const globalDiff = globalMessages.length - prevGlobalCountRef.current;
      const newCount = Math.max(0, roomDiff) + Math.max(0, globalDiff);
      if (newCount > 0) {
        setInternalUnread((u) => u + newCount);
      }
    }

    prevRoomCountRef.current = roomMessages.length;
    prevGlobalCountRef.current = globalMessages.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomMessages.length, globalMessages.length]);

  // Reset unread and re-sync refs whenever the panel opens.
  useEffect(() => {
    if (expanded) {
      setInternalUnread(0);
      prevRoomCountRef.current = roomMessages.length;
      prevGlobalCountRef.current = globalMessages.length;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  // ── End unread tracking ────────────────────────────────────────────────────

  const messages = scope === 'room' ? roomMessages : globalMessages;

  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, expanded]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(scope, text);
    setInput('');
  }

  const canSend = scope === 'global' || (scope === 'room' && roomCode != null);

  const scopeLabel = (s: ChatScope) => s === 'room' ? t('chat.room') : t('chat.global');

  // ── Collapsible variant ────────────────────────────────────────────────────
  if (collapsible) {
    return (
      // Outer div: transparent space-reservation (prevents layout shift).
      // className (card styling) goes on the inner absolutely-positioned card so
      // the visual card shrinks to header-only when collapsed — no empty gray box.
      <div className="relative" style={{ height: 260 }}>
        {/* Inner card: clips to header height when collapsed, full 260px when expanded */}
        <div
          className={`absolute inset-x-0 top-0 flex flex-col overflow-hidden ${className}`}
          style={{ height: expanded ? 260 : undefined }}
        >

          {/* Toggle header — div[role=button] to avoid nested <button> */}
          <div
            role="button"
            tabIndex={0}
            onClick={toggleExpanded}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }}
            className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${
              expanded ? 'border-b border-zinc-800' : ''
            }`}
          >
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{t('chat.title')}</span>
            <div className="flex items-center gap-2">
              {mode === 'both' && expanded && (
                <div className="flex gap-0.5">
                  {(['room', 'global'] as ChatScope[]).map((s) => (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); setScope(s); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        scope === s
                          ? 'bg-zinc-700 text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {scopeLabel(s)}
                    </button>
                  ))}
                </div>
              )}
              {showUnreadBadge && !expanded && internalUnread > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white px-1 leading-none">
                  {internalUnread > 9 ? '9+' : internalUnread}
                </span>
              )}
              <ChevronIcon expanded={expanded} />
            </div>
          </div>

          {/* Body — always mounted; opacity+pointer-events hide it when collapsed */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div
              className={`absolute inset-0 flex flex-col transition-opacity duration-150 ${
                expanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Message list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center pt-4">
                    {scope === 'room' && !roomCode ? 'Join a room to chat.' : 'No messages yet.'}
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id}>
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-indigo-400 truncate max-w-[120px]">
                          {msg.nickname}
                        </span>
                        <span className="text-[10px] text-zinc-600 shrink-0">{formatTime(msg.ts)}</span>
                      </div>
                      <p className="text-xs text-zinc-300 break-words leading-relaxed">{msg.message}</p>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Error banner */}
              {chatError && (
                <div className="mx-3 mb-2 px-2 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300 shrink-0">
                  {chatError}
                </div>
              )}

              {/* Input row */}
              <div className="px-3 pb-3 flex gap-2 shrink-0">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 200))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder={canSend ? t('chat.placeholder') : 'Join a room to chat'}
                  disabled={!canSend || !expanded}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend || !input.trim() || !expanded}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shrink-0"
                >
                  {t('chat.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard (non-collapsible) variant ────────────────────────────────────
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>

      {/* Header with tabs — only for "both" mode */}
      {mode === 'both' && (
        <div className="flex items-center justify-between border-b border-zinc-800 shrink-0 px-3">
          <span className="py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            {t('chat.title')}
          </span>
          <div className="flex">
            {(['room', 'global'] as ChatScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
                  scope === s
                    ? 'text-zinc-100 border-b-2 border-indigo-500 -mb-px'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {scopeLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center pt-6">
            {scope === 'room' && !roomCode ? 'Join a room to chat.' : 'No messages yet.'}
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-xs font-semibold text-indigo-400 truncate max-w-[130px]">
                  {msg.nickname}
                </span>
                <span className="text-[10px] text-zinc-600 shrink-0">{formatTime(msg.ts)}</span>
              </div>
              <p className="text-xs text-zinc-300 break-words leading-relaxed">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {chatError && (
        <div className="mx-3 mb-2 px-2 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300 shrink-0">
          {chatError}
        </div>
      )}

      {/* Input row */}
      <div className="px-3 pb-3 flex gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder={canSend ? t('chat.placeholder') : 'Join a room to chat'}
          disabled={!canSend}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!canSend || !input.trim()}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shrink-0"
        >
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
}
