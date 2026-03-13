'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  type SkinDef,
  type SkinProgress,
  loadSkinProgress,
  saveSkinProgress,
  buySkin,
} from '@/lib/skinShop';
import { getSupabase } from '@/lib/supabaseClient';
import { fetchCloudGameProgress, saveCloudGameProgress, loadGameProgress } from '@/lib/cloudSync';

// ── Debounced cloud save ─────────────────────────────────────────────────────

function createDebouncedCloudSave(userIdRef: React.RefObject<string | null>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const uid = userIdRef.current;
      const sb = getSupabase();
      if (!uid || !sb) return;
      try {
        await saveCloudGameProgress(sb, uid, loadGameProgress());
      } catch { /* ignore */ }
    }, 2000);
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSkinShop(gameId: string, skins: SkinDef[]) {
  const defaultSkin = skins.find((s) => s.price === 0)?.id ?? skins[0]?.id ?? '';

  const [wallet, setWallet] = useState(0);
  const [owned, setOwned] = useState<Set<string>>(new Set([defaultSkin]));
  const [activeSkin, setActiveSkin] = useState(defaultSkin);
  const [showShop, setShowShop] = useState(false);
  const activeSkinRef = useRef(defaultSkin);

  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  const debouncedCloudSave = useRef(createDebouncedCloudSave(userIdRef)).current;

  // Load on mount
  useEffect(() => {
    const p = loadSkinProgress(gameId);
    const ownedWithDefault = new Set([defaultSkin, ...p.owned]);
    setWallet(p.wallet);
    setOwned(ownedWithDefault);
    const skin = p.activeSkin && ownedWithDefault.has(p.activeSkin) ? p.activeSkin : defaultSkin;
    setActiveSkin(skin);
    activeSkinRef.current = skin;
  }, [gameId, defaultSkin]);

  // Cloud merge on login
  useEffect(() => {
    if (!user) return;
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      try {
        const cloud = await fetchCloudGameProgress(sb, user.id);
        if (!cloud?.[gameId]) return;
        const cloudP = cloud[gameId] as SkinProgress;
        if (!cloudP || typeof cloudP !== 'object' || !('wallet' in cloudP)) return;
        const local = loadSkinProgress(gameId);
        const merged: SkinProgress = {
          wallet: Math.max(local.wallet, cloudP.wallet ?? 0),
          owned: [...new Set([defaultSkin, ...local.owned, ...(cloudP.owned ?? [])])],
          activeSkin: local.activeSkin || cloudP.activeSkin || defaultSkin,
        };
        saveSkinProgress(gameId, merged);
        setWallet(merged.wallet);
        setOwned(new Set(merged.owned));
        setActiveSkin(merged.activeSkin);
        activeSkinRef.current = merged.activeSkin;
      } catch { /* ignore */ }
    })();
  }, [user, gameId, defaultSkin]);

  const save = useCallback((p: SkinProgress) => {
    saveSkinProgress(gameId, p);
    setWallet(p.wallet);
    setOwned(new Set(p.owned));
    setActiveSkin(p.activeSkin);
    activeSkinRef.current = p.activeSkin;
    debouncedCloudSave();
  }, [gameId, debouncedCloudSave]);

  const handleBuy = useCallback((skinId: string) => {
    const current = loadSkinProgress(gameId);
    current.owned = [...new Set([defaultSkin, ...current.owned])];
    const result = buySkin(skins, skinId, current);
    if (result) save(result);
  }, [gameId, skins, save, defaultSkin]);

  const handleEquip = useCallback((skinId: string) => {
    const current = loadSkinProgress(gameId);
    current.activeSkin = skinId;
    save(current);
  }, [gameId, save]);

  const addCoins = useCallback((amount: number) => {
    const current = loadSkinProgress(gameId);
    current.owned = [...new Set([defaultSkin, ...current.owned])];
    current.wallet += amount;
    save(current);
  }, [gameId, save, defaultSkin]);

  const activeSkinDef = skins.find((s) => s.id === activeSkin) ?? skins[0];

  return {
    wallet,
    owned,
    activeSkin,
    activeSkinRef,
    activeSkinDef,
    showShop,
    setShowShop,
    buy: handleBuy,
    equip: handleEquip,
    addCoins,
    save,
  };
}
