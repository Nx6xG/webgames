'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CosmeticsSelection } from 'shared';
import {
  generateRandomNickname,
  getStoredNickname,
  sanitizeNickname,
  setStoredNickname,
} from '@/lib/nickname';
import { DEFAULT_AVATAR_ID } from '@/lib/avatars';
import { loadCosmetics, saveCosmetics, mergeCosmetics } from '@/lib/cosmetics';

interface NicknameContextValue {
  nickname: string;
  setNickname: (raw: string) => void;
  avatarId: string;
  setAvatarId: (id: string) => void;
  nameColor: string | undefined;
  setNameColor: (color: string | undefined) => void;
  avatarFrame: string | undefined;
  setAvatarFrame: (frame: string | undefined) => void;
  /** Unified cosmetics state */
  cosmetics: CosmeticsSelection;
  /** Merge a partial update into cosmetics, save, and sync state */
  updateCosmetics: (patch: Partial<CosmeticsSelection>) => void;
}

const NicknameContext = createContext<NicknameContextValue>({
  nickname: '',
  setNickname: () => {},
  avatarId: DEFAULT_AVATAR_ID,
  setAvatarId: () => {},
  nameColor: undefined,
  setNameColor: () => {},
  avatarFrame: undefined,
  setAvatarFrame: () => {},
  cosmetics: { slots: {} },
  updateCosmetics: () => {},
});

export function NicknameProvider({ children }: { children: React.ReactNode }) {
  const [nickname, setNicknameState] = useState('');
  const [cosmetics, setCosmeticsState] = useState<CosmeticsSelection>({ slots: {} });

  useEffect(() => {
    let stored = getStoredNickname();
    if (!stored) {
      stored = generateRandomNickname();
      setStoredNickname(stored);
    }
    setNicknameState(stored);
    setCosmeticsState(loadCosmetics());
  }, []);

  const setNickname = useCallback((raw: string) => {
    const clean = sanitizeNickname(raw);
    if (clean.length < 2) return;
    setStoredNickname(clean);
    setNicknameState(clean);
  }, []);

  const updateCosmetics = useCallback((patch: Partial<CosmeticsSelection>) => {
    setCosmeticsState((prev) => {
      const merged = mergeCosmetics(prev, patch);
      saveCosmetics(merged);
      return merged;
    });
  }, []);

  // Legacy setters that delegate to updateCosmetics
  const setAvatarId = useCallback((id: string) => {
    updateCosmetics({ avatarId: id });
  }, [updateCosmetics]);

  const setNameColor = useCallback((color: string | undefined) => {
    updateCosmetics({ nameColor: color });
  }, [updateCosmetics]);

  const setAvatarFrame = useCallback((frame: string | undefined) => {
    updateCosmetics({ slots: { frame: frame || undefined } });
  }, [updateCosmetics]);

  // Derived legacy values
  const avatarId = cosmetics.avatarId || DEFAULT_AVATAR_ID;
  const nameColor = cosmetics.nameColor;
  const avatarFrame = cosmetics.slots?.frame;

  return (
    <NicknameContext.Provider value={{ nickname, setNickname, avatarId, setAvatarId, nameColor, setNameColor, avatarFrame, setAvatarFrame, cosmetics, updateCosmetics }}>
      {children}
    </NicknameContext.Provider>
  );
}

export function useNickname(): NicknameContextValue {
  return useContext(NicknameContext);
}
