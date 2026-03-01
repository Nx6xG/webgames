'use client';

import { useRef, useState } from 'react';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { FloatingChatButton } from './FloatingChatButton';
import { ChatDrawer } from './ChatDrawer';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export function GlobalChatWidget() {
  const [open, setOpen] = useState(false);
  const seenCountRef = useRef(0);

  const { globalMessages, chatError, sendGlobalChat } = useGlobalChat(WS_URL);

  const unreadCount = open ? 0 : Math.max(0, globalMessages.length - seenCountRef.current);

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
