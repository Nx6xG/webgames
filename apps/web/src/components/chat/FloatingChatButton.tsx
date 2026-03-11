'use client';

interface FloatingChatButtonProps {
  open: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export function FloatingChatButton({ open, onClick, unreadCount = 0 }: FloatingChatButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Close chat' : 'Open global chat'}
      className="fixed bottom-16 right-6 z-40 w-[52px] h-[52px] rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-900/40 transition-all duration-150 flex items-center justify-center"
    >
      {open ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}

      {/* Unread badge */}
      {!open && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
