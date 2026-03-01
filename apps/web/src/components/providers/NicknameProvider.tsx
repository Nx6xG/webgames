'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  generateRandomNickname,
  getStoredNickname,
  sanitizeNickname,
  setStoredNickname,
} from '@/lib/nickname';

interface NicknameContextValue {
  nickname: string;
  setNickname: (raw: string) => void;
}

const NicknameContext = createContext<NicknameContextValue>({
  nickname: '',
  setNickname: () => {},
});

export function NicknameProvider({ children }: { children: React.ReactNode }) {
  const [nickname, setNicknameState] = useState('');

  useEffect(() => {
    let stored = getStoredNickname();
    if (!stored) {
      stored = generateRandomNickname();
      setStoredNickname(stored);
    }
    setNicknameState(stored);
  }, []);

  const setNickname = useCallback((raw: string) => {
    const clean = sanitizeNickname(raw);
    if (clean.length < 2) return;
    setStoredNickname(clean);
    setNicknameState(clean);
  }, []);

  return (
    <NicknameContext.Provider value={{ nickname, setNickname }}>
      {children}
    </NicknameContext.Provider>
  );
}

export function useNickname(): NicknameContextValue {
  return useContext(NicknameContext);
}
