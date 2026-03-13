'use client';

import { useEffect, useRef, useState } from 'react';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { useNickname } from '@/components/providers/NicknameProvider';
import { FloatingChatButton } from './FloatingChatButton';
import { ChatDrawer } from './ChatDrawer';

export function GlobalChatWidget() {
  const [open, setOpen] = useState(false);
  const seenCountRef = useRef<number | null>(null);
  const { nickname } = useNickname();

  // Empty string → hook resolves URL at runtime via getWsUrl() (window fallback).
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';
  const { globalMessages, chatError, sendGlobalChat } = useGlobalChat(wsUrl, nickname);

  // Mark initial chat_history batch as already seen so old messages don't show as unread
  useEffect(() => {
    if (seenCountRef.current === null && globalMessages.length > 0) {
      seenCountRef.current = globalMessages.length;
    }
  }, [globalMessages.length]);

  const seen = seenCountRef.current ?? 0;
  const unreadCount = open ? 0 : Math.max(0, globalMessages.length - seen);

  function handleOpen() {
    seenCountRef.current = globalMessages.length;
    setOpen(true);
  }

  function handleClose() {
    seenCountRef.current = globalMessages.length;
    setOpen(false);
  }

  return (
    <>
      <FloatingChatButton
        open={open}
        onClick={open ? handleClose : handleOpen}
        unreadCount={unreadCount}
      />
      <ChatDrawer
        open={open}
        onClose={handleClose}
        globalMessages={globalMessages}
        chatError={chatError}
        onSend={sendGlobalChat}
      />
    </>
  );
}
