'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { SkinDef } from '@/lib/skinShop';
import { isLocked } from '@/lib/skinShop';
import type { SkinProgress } from '@/lib/skinShop';

interface Props {
  skins: SkinDef[];
  wallet: number;
  owned: Set<string>;
  activeSkin: string;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
  onClose: () => void;
  renderPreview: (ctx: CanvasRenderingContext2D, skin: SkinDef, size: number) => void;
  lockedLabel?: string; // shown for requireAll skins that are locked
}

function SkinPreviewCanvas({
  skin,
  size,
  renderPreview,
}: {
  skin: SkinDef;
  size: number;
  renderPreview: (ctx: CanvasRenderingContext2D, skin: SkinDef, size: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    renderPreview(ctx, skin, size);
  }, [skin, size, renderPreview]);

  return <canvas ref={canvasRef} width={size} height={size} className="block" />;
}

export function SkinShopOverlay({
  skins,
  wallet,
  owned,
  activeSkin,
  onBuy,
  onEquip,
  onClose,
  renderPreview,
  lockedLabel,
}: Props) {
  const { t } = useI18n();

  const progress: SkinProgress = {
    wallet,
    owned: [...owned],
    activeSkin,
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-zinc-950 rounded-xl overflow-auto scrollbar-none z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-xl font-black text-white tracking-tight">{t('skinShop.title')}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-800/30">
            <span className="text-base">●</span> {wallet}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-2xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2.5 px-4 pb-5">
        {skins.map((skin) => {
          const isOwned = owned.has(skin.id);
          const active = activeSkin === skin.id;
          const locked = isLocked(skins, skin.id, progress);
          const canAfford = !locked && wallet >= skin.price && skin.price > 0;

          const rarityBorder = active
            ? 'border-amber-400 shadow-amber-500/20 shadow-lg'
            : skin.price <= 0
              ? 'border-zinc-700'
              : skin.price <= 30
                ? 'border-emerald-800/50'
                : skin.price <= 75
                  ? 'border-blue-800/50'
                  : skin.price <= 200
                    ? 'border-purple-800/50'
                    : 'border-amber-700/50';

          return (
            <button
              key={skin.id}
              onClick={() => {
                if (isOwned) onEquip(skin.id);
                else if (canAfford) onBuy(skin.id);
              }}
              disabled={!isOwned && (!canAfford || locked)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${rarityBorder} ${
                active
                  ? 'bg-amber-950/60'
                  : isOwned
                    ? 'bg-zinc-800/80 hover:bg-zinc-700/80'
                    : canAfford && !locked
                      ? 'bg-zinc-800/60 hover:bg-zinc-700/60 hover:scale-105'
                      : 'bg-zinc-900/60 opacity-40 cursor-not-allowed'
              }`}
            >
              <SkinPreviewCanvas skin={skin} size={48} renderPreview={renderPreview} />
              <span className="text-[11px] font-bold text-zinc-200">
                {t(skin.nameKey)}
              </span>
              {active && (
                <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">
                  {t('skinShop.equipped')}
                </span>
              )}
              {isOwned && !active && (
                <span className="text-[10px] text-emerald-500 font-semibold">
                  {t('skinShop.owned')}
                </span>
              )}
              {!isOwned && locked && (
                <span className="text-[9px] font-semibold text-zinc-500 text-center leading-tight">
                  {lockedLabel ?? t('skinShop.locked')}
                </span>
              )}
              {!isOwned && !locked && (
                <span
                  className={`text-[10px] font-bold flex items-center gap-1 ${
                    canAfford ? 'text-amber-400' : 'text-zinc-600'
                  }`}
                >
                  ● {skin.price}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
