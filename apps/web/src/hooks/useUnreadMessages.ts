'use client';
import { useEffect, useRef, useState } from 'react';

interface ChatMessages {
  roomMessages: unknown[];
  globalMessages: unknown[];
}

/**
 * Tracks unread chat messages while the chat panel is collapsed.
 * Returns chat-open state + unread count; opening the chat resets the count.
 */
export function useUnreadMessages(mp: ChatMessages) {
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevTotalRef = useRef<number | null>(null);

  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) {
      prevTotalRef.current = total;
      return;
    }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.roomMessages.length, mp.globalMessages.length]);

  const handleOpenChange = (open: boolean) => {
    setChatOpen(open);
    if (open) setUnread(0);
  };

  return { chatOpen, setChatOpen: handleOpenChange, unread } as const;
}
