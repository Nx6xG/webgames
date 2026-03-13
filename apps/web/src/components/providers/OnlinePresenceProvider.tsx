'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { useAuth } from '@/components/providers/AuthProvider';
import type { OnlineUser, InvitePayload, GameId } from 'shared';
import type { AcceptedInvite } from '@/hooks/useOnlineUsers';

export interface OnlinePresenceValue {
  users: OnlineUser[];
  connected: boolean;
  incomingInvites: InvitePayload[];
  sentInvite: { id: string; roomCode: string; gameId: GameId } | null;
  inviteError: string | null;
  acceptedInvite: AcceptedInvite | null;
  sendInvite: (toToken: string, gameId: GameId) => void;
  acceptInvite: (invite: InvitePayload) => void;
  dismissInvite: (id: string) => void;
  dismissSentInvite: () => void;
  dismissAcceptedInvite: () => void;
}

const fallback: OnlinePresenceValue = {
  users: [],
  connected: false,
  incomingInvites: [],
  sentInvite: null,
  inviteError: null,
  acceptedInvite: null,
  sendInvite: () => {},
  acceptInvite: () => {},
  dismissInvite: () => {},
  dismissSentInvite: () => {},
  dismissAcceptedInvite: () => {},
};

const Ctx = createContext<OnlinePresenceValue>(fallback);

export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const value = useOnlineUsers('', user?.id);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnlinePresence() {
  return useContext(Ctx);
}
