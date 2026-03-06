'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import { getCosmeticDef } from '@/lib/cosmetics';
import type { CosmeticsSelection } from 'shared';

interface Props {
  cosmetics: CosmeticsSelection;
}

const SLOTS = ['frame', 'head', 'portal', 'aura', 'banner', 'cardColor'] as const;
const FALLBACK_EMOJI: Record<string, string> = {
  frame: '◆', head: '👑', portal: '🕳️', aura: '✨', banner: '🌅', cardColor: '🎨',
};
const TAB_KEY: Record<string, string> = {
  frame: 'studio.tab.frame', head: 'studio.tab.head', portal: 'studio.tab.portal',
  aura: 'studio.tab.aura', banner: 'studio.tab.banner', cardColor: 'studio.tab.cardColor',
};

export function ProfileShowcase({ cosmetics }: Props) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((slot) => {
          const id = cosmetics.slots?.[slot];
          const active = !!id;
          const def = id ? getCosmeticDef(id, slot) : undefined;
          const emoji = def?.emoji ?? (active ? FALLBACK_EMOJI[slot] : '⊘');
          return (
            <div
              key={slot}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg ${active ? 'bg-zinc-700/30' : 'bg-zinc-800/20 opacity-40'}`}
              title={t(TAB_KEY[slot])}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-[9px] text-zinc-500 font-medium">{t(TAB_KEY[slot])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
