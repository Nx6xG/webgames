'use client';

import { useState } from 'react';
import type { ChatMessage } from 'shared';
import { ChatPanel, type ChatPanelProps } from './ChatPanel';
import { ProfileViewerModal } from '@/components/ui/ProfileViewerModal';
import { resolveOtherProfile, resolveMyProfile } from '@/lib/profileData';
import { useNickname } from '@/components/providers/NicknameProvider';
import type { ProfileData } from '@/lib/profileData';

const TOKEN_KEY = 'wg_player_token';

/**
 * Wraps ChatPanel and adds clickable-nickname → ProfileViewerModal.
 * Drop-in replacement for ChatPanel — accepts same props.
 */
export function ChatPanelWithProfile(props: Omit<ChatPanelProps, 'onClickNickname'>) {
  const { nickname: myNickname } = useNickname();
  const [viewedProfile, setViewedProfile] = useState<ProfileData | null>(null);

  function handleClickNickname(msg: ChatMessage) {
    const myToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) ?? '' : '';
    const isMe = !!myToken && msg.playerToken === myToken;
    const pd = isMe
      ? resolveMyProfile(myNickname, myToken)
      : resolveOtherProfile(msg.playerToken ?? '', msg.nickname, msg.cosmetics);
    setViewedProfile(pd);
  }

  return (
    <>
      <ChatPanel {...props} onClickNickname={handleClickNickname} />
      {viewedProfile && (
        <ProfileViewerModal
          profile={viewedProfile}
          onClose={() => setViewedProfile(null)}
        />
      )}
    </>
  );
}
