'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';

interface NexusClashTutorialProps {
  onClose: () => void;
}

const STEP_ICONS: React.ReactNode[] = [
  // Step 1: Welcome - crossed swords
  <svg key="s1" viewBox="0 0 48 48" className="w-12 h-12"><path d="M14 34L34 14" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"/><path d="M34 34L14 14" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="24" r="4" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><polygon points="24,6 26,10 22,10" fill="#c9a84c"/><polygon points="24,42 26,38 22,38" fill="#c9a84c"/></svg>,
  // Step 2: Cards - playing cards
  <svg key="s2" viewBox="0 0 48 48" className="w-12 h-12"><rect x="12" y="8" width="18" height="26" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.5" transform="rotate(-8 21 21)"/><rect x="18" y="10" width="18" height="26" rx="2" fill="#12121f" stroke="#c9a84c" strokeWidth="1.5" transform="rotate(8 27 23)"/><text x="27" y="27" textAnchor="middle" fill="#c9a84c" fontSize="10" fontWeight="bold">5</text></svg>,
  // Step 3: Simultaneous - two arrows
  <svg key="s3" viewBox="0 0 48 48" className="w-12 h-12"><path d="M10 20L24 10L38 20" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 32L24 42L38 32" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="24" y1="14" x2="24" y2="38" stroke="#c9a84c" strokeWidth="1.5" strokeDasharray="3 2"/></svg>,
  // Step 4: Push/Breakthrough - bar filling up
  <svg key="s4" viewBox="0 0 48 48" className="w-12 h-12"><rect x="8" y="18" width="32" height="12" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><rect x="9" y="19" width="22" height="10" rx="1" fill="#c9a84c" opacity="0.5"/><polygon points="38,14 42,24 38,34" fill="#c9a84c"/></svg>,
  // Step 5: Abilities - sparkle
  <svg key="s5" viewBox="0 0 48 48" className="w-12 h-12"><polygon points="24,6 27,18 38,18 29,26 32,38 24,30 16,38 19,26 10,18 21,18" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="24" cy="22" r="3" fill="#c9a84c" opacity="0.5"/></svg>,
  // Step 6: Mana/Rounds - hourglass
  <svg key="s6" viewBox="0 0 48 48" className="w-12 h-12"><path d="M16 8H32M16 40H32" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"/><path d="M18 8C18 8 18 18 24 24C30 18 30 8 30 8" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><path d="M18 40C18 40 18 30 24 24C30 30 30 40 30 40" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><circle cx="24" cy="34" r="2" fill="#c9a84c" opacity="0.5"/></svg>,
];

const TOTAL_STEPS = 6;

export function NexusClashTutorial({ onClose }: NexusClashTutorialProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else onClose();
  }, [step, onClose]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, next, prev]);

  const stepNum = step + 1;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-5 w-[90vw] max-w-md"
        style={{
          padding: '32px 28px',
          background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
          border: '1px solid #2a2a3a',
          borderRadius: '12px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(201,168,76,0.05)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full" style={{ background: '#1a1a08', border: '1px solid #c9a84c33' }}>
          {STEP_ICONS[step]}
        </div>

        {/* Title */}
        <h2 className="text-lg font-black uppercase tracking-wider text-center" style={{ color: '#c9a84c' }}>
          {t(`nc.tutorial.step${stepNum}.title`)}
        </h2>

        {/* Text */}
        <p className="text-sm text-center leading-relaxed" style={{ color: '#8a8a9a' }}>
          {t(`nc.tutorial.step${stepNum}.text`)}
        </p>

        {/* Step dots */}
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === step ? '#c9a84c' : '#2a2a3a',
                boxShadow: i === step ? '0 0 6px rgba(201,168,76,0.4)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 w-full">
          {step > 0 && (
            <button
              onClick={prev}
              className="flex-1 px-4 py-2.5 rounded text-sm font-semibold transition-all"
              style={{ border: '1px solid #2a2a3a', color: '#6a6a7a', background: '#12121f' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#c9a84c44'; e.currentTarget.style.color = '#c9a84c'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#6a6a7a'; }}
            >
              {t('nc.tutorial.prev')}
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 px-4 py-2.5 rounded font-bold text-sm uppercase tracking-wider transition-all"
            style={{
              background: 'linear-gradient(135deg, #c9a84c, #a07c2a)',
              border: '1px solid #e8d48b',
              color: '#0e0e1a',
              boxShadow: '0 0 15px rgba(201,168,76,0.2)',
            }}
          >
            {isLast ? t('nc.tutorial.done') : t('nc.tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
