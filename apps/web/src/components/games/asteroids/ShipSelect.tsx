'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import type { ShipId, ShipDef, MilestoneDef, MilestoneId } from './roguelite-types';

interface ShipSelectProps {
  ships: ShipDef[];
  selectedShip: ShipId;
  isUnlocked: (id: ShipId) => boolean;
  milestones: MilestoneDef[];
  unlockedMilestones: MilestoneId[];
  onSelect: (id: ShipId) => void;
  onClose: () => void;
}

export default function ShipSelect({ ships, selectedShip, isUnlocked, milestones, unlockedMilestones, onSelect, onClose }: ShipSelectProps) {
  const { t } = useI18n();

  function getUnlockInfo(shipId: ShipId): { milestone: MilestoneDef; done: boolean } | null {
    if (shipId === 'vanguard') return null;
    const ms = milestones.find((m) => m.unlock.type === 'ship' && m.unlock.shipId === shipId);
    if (!ms) return null;
    return { milestone: ms, done: unlockedMilestones.includes(ms.id) };
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]/95 animate-[fadeIn_0.25s_ease-out]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <h1 className="text-2xl font-black tracking-widest text-[var(--fg)] uppercase">{t('asteroids.rl.ship.select')}</h1>
        <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-xl font-bold cursor-pointer">X</button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {ships.map((ship) => {
            const unlocked = isUnlocked(ship.id);
            const active = ship.id === selectedShip;
            const info = getUnlockInfo(ship.id);
            return (
              <button key={ship.id} onClick={() => unlocked && onSelect(ship.id)} disabled={!unlocked} className={`relative flex flex-col gap-3 rounded-xl border p-5 text-left transition-all duration-200 ${active ? 'border-2 ring-2 ring-white/20' : 'border-[var(--border)]'} ${unlocked ? 'bg-[var(--card)] cursor-pointer hover:scale-[1.02]' : 'bg-zinc-900/50 opacity-60 cursor-not-allowed'}`} style={active ? { borderColor: ship.color } : undefined}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg text-2xl" style={{ backgroundColor: (unlocked ? ship.color : '#71717a') + '22', color: unlocked ? ship.color : '#71717a' }}>{ship.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[var(--fg)]">{t(ship.nameKey)}</h3>
                    {active && <span className="text-xs font-semibold uppercase" style={{ color: ship.color }}>ACTIVE</span>}
                    {unlocked && !active && <span className="text-xs font-semibold text-emerald-400 uppercase">{t('asteroids.rl.ship.unlocked')}</span>}
                  </div>
                </div>
                <p className="text-sm text-[var(--muted)]">{t(ship.descKey)}</p>
                <div className="text-xs font-semibold" style={{ color: unlocked ? ship.color : '#71717a' }}>{t('asteroids.rl.ship.passive')}: {t(ship.passiveKey)}</div>
                {/* Unlock requirement for locked ships */}
                {!unlocked && info && (
                  <div className="mt-auto pt-2 border-t border-zinc-800">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-400 font-bold uppercase">{t('asteroids.rl.ship.locked')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                      <span>{info.milestone.icon}</span>
                      <span className="font-semibold text-zinc-300">{t(info.milestone.nameKey)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{t(info.milestone.descKey)}</p>
                  </div>
                )}
                {/* Default ship badge */}
                {ship.id === 'vanguard' && !active && (
                  <div className="text-xs text-zinc-500">{t('asteroids.rl.ship.default')}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
