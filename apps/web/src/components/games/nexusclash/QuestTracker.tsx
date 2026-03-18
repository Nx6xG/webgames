'use client';

import type { NcQuest, NcPlayerProfile } from 'shared';
import { NC_BP_QUEST_XP } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';

interface QuestTrackerProps {
  profile: NcPlayerProfile;
  onClaimQuest: (questId: string) => void;
  onClose: () => void;
}

// Currency icons
function CoinIcon({ size = 10 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="10" cy="10" r="8" fill="#c9a84c" stroke="#a07c2a" strokeWidth="1.5"/>
      <text x="10" y="13.5" textAnchor="middle" fill="#7a5c1a" fontSize="8" fontWeight="bold">C</text>
    </svg>
  );
}

function GemIcon({ size = 10 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>
      <polygon points="10,2 16,7 14,17 6,17 4,7" fill="#7c3aed" stroke="#a78bfa" strokeWidth="1"/>
    </svg>
  );
}

function QuestRow({ quest, onClaim }: { quest: NcQuest; onClaim: () => void }) {
  const { t } = useI18n();
  const progress = Math.min(quest.currentCount / quest.targetCount, 1);
  const isComplete = quest.completed || quest.currentCount >= quest.targetCount;

  const goalLabel = t(`nc.quest.goal.${quest.goalType}`) +
    (quest.goalParam ? ` (${t(`nc.tag.${quest.goalParam}`)})` : '');

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all" style={{
      background: isComplete
        ? 'linear-gradient(135deg, #0a1a0a, #12121f)'
        : 'linear-gradient(135deg, #12121f, #0e0e1a)',
      border: isComplete ? '1px solid #c9a84c33' : '1px solid #1e1e3a',
    }}>
      {/* Quest icon */}
      <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{
        background: isComplete ? '#1a2a0a' : '#0a0a12',
        border: isComplete ? '1px solid #c9a84c44' : '1px solid #2a2a3a',
      }}>
        {isComplete ? (
          <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="8,1 10,6 15,6 11,9 12.5,14 8,11 3.5,14 5,9 1,6 6,6" fill="#c9a84c"/></svg>
        ) : (
          <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx="8" cy="8" r="6" fill="none" stroke="#3a3a4a" strokeWidth="1.5"/><path d="M5 8L7 10L11 6" fill="none" stroke="#3a3a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: isComplete ? '#c9a84c' : '#b0b0b8' }}>{goalLabel}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{
            background: '#0a0a12',
            border: '1px solid #1e1e3a',
          }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress * 100}%`,
                background: isComplete
                  ? 'linear-gradient(to right, #c9a84c, #e8d48b)'
                  : 'linear-gradient(to right, #4a7dff, #7c3aed)',
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums shrink-0" style={{ color: '#5a5a6a' }}>
            {quest.currentCount}/{quest.targetCount}
          </span>
        </div>
      </div>

      {/* Reward */}
      <div className="flex items-center gap-1.5 shrink-0">
        {quest.reward.coins && (
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] font-bold" style={{ color: '#c9a84c' }}>+{quest.reward.coins}</span>
            <CoinIcon />
          </div>
        )}
        {quest.reward.gems && (
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] font-bold" style={{ color: '#7c3aed' }}>+{quest.reward.gems}</span>
            <GemIcon />
          </div>
        )}
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] font-bold" style={{ color: '#4a7dff' }}>+{NC_BP_QUEST_XP}</span>
          <span className="text-[8px] font-bold" style={{ color: '#4a7dff' }}>{t('nc.bp.bpXp')}</span>
        </div>
      </div>

      {/* Claim button */}
      {isComplete && !quest.completed && (
        <button
          onClick={onClaim}
          className="px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 transition-all"
          style={{
            background: 'linear-gradient(135deg, #c9a84c, #a07c2a)',
            color: '#0a0a12',
            border: '1px solid #e8d48b',
            boxShadow: '0 0 10px rgba(201,168,76,0.2)',
          }}
        >
          {t('nc.quest.claim')}
        </button>
      )}
      {quest.completed && (
        <div className="shrink-0">
          <svg viewBox="0 0 16 16" className="w-4 h-4"><path d="M4 8L7 11L12 5" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
    </div>
  );
}

export function QuestTracker({ profile, onClaimQuest, onClose }: QuestTrackerProps) {
  const { t } = useI18n();

  const dailyQuests = profile.quests.filter(q => q.type === 'daily');
  const weeklyQuests = profile.quests.filter(q => q.type === 'weekly');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)',
      backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div
        className="flex flex-col gap-5"
        style={{
          width: '95vw',
          maxWidth: '550px',
          padding: '24px',
          background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
          border: '1px solid #2a2a3a',
          borderRadius: '8px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 20px rgba(124,58,237,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-[0.1em]" style={{ color: '#c9a84c' }}>{t('nc.quest.title')}</h2>
          <button onClick={onClose} className="text-xl leading-none transition-colors" style={{ color: '#5a5a6a' }}
            onMouseOver={e => (e.currentTarget.style.color = '#c9a84c')}
            onMouseOut={e => (e.currentTarget.style.color = '#5a5a6a')}
          >&times;</button>
        </div>

        {/* Daily */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="#c9a84c" strokeWidth="1"/>
              <line x1="8" y1="4" x2="8" y2="8" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="8" x2="11" y2="10" stroke="#c9a84c" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#c9a84c88' }}>{t('nc.quest.daily')}</p>
          </div>
          <div className="flex flex-col gap-2">
            {dailyQuests.length === 0 && (
              <p className="text-xs py-2" style={{ color: '#3a3a4a' }}>{t('nc.quest.noQuests')}</p>
            )}
            {dailyQuests.map(q => (
              <QuestRow key={q.id} quest={q} onClaim={() => onClaimQuest(q.id)} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, #c9a84c22, transparent)' }} />

        {/* Weekly */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
              <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="#7c3aed" strokeWidth="1"/>
              <line x1="2" y1="6" x2="14" y2="6" stroke="#7c3aed" strokeWidth="0.8"/>
              <line x1="5" y1="3" x2="5" y2="1" stroke="#7c3aed" strokeWidth="1" strokeLinecap="round"/>
              <line x1="11" y1="3" x2="11" y2="1" stroke="#7c3aed" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#7c3aed88' }}>{t('nc.quest.weekly')}</p>
          </div>
          <div className="flex flex-col gap-2">
            {weeklyQuests.length === 0 && (
              <p className="text-xs py-2" style={{ color: '#3a3a4a' }}>{t('nc.quest.noQuests')}</p>
            )}
            {weeklyQuests.map(q => (
              <QuestRow key={q.id} quest={q} onClaim={() => onClaimQuest(q.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
