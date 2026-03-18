'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';

interface NexusClashTutorialProps {
  onClose: () => void;
}

const STEP_ICONS: React.ReactNode[] = [
  // Step 1: Welcome - Nexus emblem
  <svg key="s1" viewBox="0 0 48 48" className="w-12 h-12"><path d="M14 34L34 14" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"/><path d="M34 34L14 14" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="24" r="4" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><polygon points="24,6 26,10 22,10" fill="#c9a84c"/><polygon points="24,42 26,38 22,38" fill="#c9a84c"/></svg>,
  // Step 2: Ziel - trophy
  <svg key="s2" viewBox="0 0 48 48" className="w-12 h-12"><path d="M16 12H32V22C32 28 28 32 24 34C20 32 16 28 16 22Z" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><path d="M16 14H10C10 14 10 22 16 22" fill="none" stroke="#c9a84c" strokeWidth="1.2"/><path d="M32 14H38C38 14 38 22 32 22" fill="none" stroke="#c9a84c" strokeWidth="1.2"/><line x1="24" y1="34" x2="24" y2="38" stroke="#c9a84c" strokeWidth="1.5"/><line x1="18" y1="38" x2="30" y2="38" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  // Step 3: Lanes - three columns
  <svg key="s3" viewBox="0 0 48 48" className="w-12 h-12"><rect x="6" y="10" width="10" height="28" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.3"/><rect x="19" y="10" width="10" height="28" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.3"/><rect x="32" y="10" width="10" height="28" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.3"/><circle cx="11" cy="24" r="2" fill="#c9a84c" opacity="0.5"/><circle cx="24" cy="24" r="2" fill="#c9a84c" opacity="0.5"/><circle cx="37" cy="24" r="2" fill="#c9a84c" opacity="0.5"/></svg>,
  // Step 4: Karten & Mana - card with gem
  <svg key="s4" viewBox="0 0 48 48" className="w-12 h-12"><rect x="14" y="8" width="20" height="28" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><circle cx="20" cy="14" r="3" fill="none" stroke="#4a7dff" strokeWidth="1.2"/><text x="20" y="16" textAnchor="middle" fill="#4a7dff" fontSize="6" fontWeight="bold">3</text><circle cx="28" cy="14" r="3" fill="none" stroke="#ef4444" strokeWidth="1.2"/><text x="28" y="16" textAnchor="middle" fill="#ef4444" fontSize="6" fontWeight="bold">5</text><line x1="16" y1="22" x2="32" y2="22" stroke="#c9a84c" strokeWidth="0.5" opacity="0.4"/><rect x="17" y="25" width="14" height="2" rx="0.5" fill="#c9a84c" opacity="0.2"/><rect x="17" y="29" width="10" height="2" rx="0.5" fill="#c9a84c" opacity="0.15"/></svg>,
  // Step 5: Gleichzeitig - two players
  <svg key="s5" viewBox="0 0 48 48" className="w-12 h-12"><circle cx="14" cy="16" r="5" fill="none" stroke="#4a7dff" strokeWidth="1.3"/><path d="M6 32C6 26 10 24 14 24C18 24 22 26 22 32" fill="none" stroke="#4a7dff" strokeWidth="1.3"/><circle cx="34" cy="16" r="5" fill="none" stroke="#ef4444" strokeWidth="1.3"/><path d="M26 32C26 26 30 24 34 24C38 24 42 26 42 32" fill="none" stroke="#ef4444" strokeWidth="1.3"/><path d="M22 38L26 42L22 46" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M26 38L22 42L26 46" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  // Step 6: Schub - push bar
  <svg key="s6" viewBox="0 0 48 48" className="w-12 h-12"><rect x="4" y="20" width="40" height="8" rx="2" fill="none" stroke="#c9a84c" strokeWidth="1.3"/><rect x="5" y="21" width="24" height="6" rx="1" fill="#4a7dff" opacity="0.5"/><rect x="29" y="21" width="14" height="6" rx="1" fill="#ef4444" opacity="0.5"/><polygon points="30,16 32,20 28,20" fill="#c9a84c"/><line x1="24" y1="20" x2="24" y2="28" stroke="#c9a84c" strokeWidth="0.8" strokeDasharray="1.5 1"/></svg>,
  // Step 7: Durchbruch - breakthrough icon
  <svg key="s7" viewBox="0 0 48 48" className="w-12 h-12"><polygon points="24,4 28,16 40,16 30,24 34,36 24,28 14,36 18,24 8,16 20,16" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="24" cy="20" r="4" fill="#c9a84c" opacity="0.3"/><text x="24" y="23" textAnchor="middle" fill="#c9a84c" fontSize="7" fontWeight="bold">!</text></svg>,
  // Step 8: Abilities - sparkle
  <svg key="s8" viewBox="0 0 48 48" className="w-12 h-12"><polygon points="24,6 27,18 38,18 29,26 32,38 24,30 16,38 19,26 10,18 21,18" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="24" cy="22" r="3" fill="#c9a84c" opacity="0.5"/></svg>,
  // Step 9: Deck & Hand - hand of cards
  <svg key="s9" viewBox="0 0 48 48" className="w-12 h-12"><rect x="8" y="14" width="12" height="18" rx="1.5" fill="none" stroke="#c9a84c" strokeWidth="1.2" transform="rotate(-12 14 23)"/><rect x="18" y="12" width="12" height="18" rx="1.5" fill="#12121f" stroke="#c9a84c" strokeWidth="1.2"/><rect x="28" y="14" width="12" height="18" rx="1.5" fill="none" stroke="#c9a84c" strokeWidth="1.2" transform="rotate(12 34 23)"/><path d="M16 36C16 36 20 40 24 40C28 40 32 36 32 36" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.5"/></svg>,
  // Step 10: Tipps - lightbulb
  <svg key="s10" viewBox="0 0 48 48" className="w-12 h-12"><path d="M24 6C17 6 12 11 12 18C12 23 15 26 18 28V32H30V28C33 26 36 23 36 18C36 11 31 6 24 6Z" fill="none" stroke="#c9a84c" strokeWidth="1.5"/><line x1="18" y1="35" x2="30" y2="35" stroke="#c9a84c" strokeWidth="1.2"/><line x1="19" y1="38" x2="29" y2="38" stroke="#c9a84c" strokeWidth="1.2"/><line x1="24" y1="14" x2="24" y2="22" stroke="#c9a84c" strokeWidth="1" opacity="0.5"/><line x1="20" y1="18" x2="28" y2="18" stroke="#c9a84c" strokeWidth="1" opacity="0.5"/></svg>,
];

const TOTAL_STEPS = 10;

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

  // Steps can have multiple text paragraphs: text, text2, text3
  const texts: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const key = i === 1 ? `nc.tutorial.step${stepNum}.text` : `nc.tutorial.step${stepNum}.text${i}`;
    const val = t(key);
    if (val && val !== key) texts.push(val);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #0a0a12ee, #050510ff)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-4 w-[90vw] max-w-md max-h-[85vh] overflow-y-auto"
        style={{
          padding: '28px 24px',
          background: 'linear-gradient(180deg, #12121f, #0e0e1a)',
          border: '1px solid #2a2a3a',
          borderRadius: '12px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(201,168,76,0.05)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header: Step counter */}
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#c9a84c66' }}>
          {stepNum} / {TOTAL_STEPS}
        </span>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full shrink-0" style={{ background: '#1a1a08', border: '1px solid #c9a84c33' }}>
          {STEP_ICONS[step]}
        </div>

        {/* Title */}
        <h2 className="text-base font-black uppercase tracking-wider text-center" style={{ color: '#c9a84c' }}>
          {t(`nc.tutorial.step${stepNum}.title`)}
        </h2>

        {/* Text paragraphs */}
        <div className="flex flex-col gap-2.5 w-full">
          {texts.map((txt, i) => (
            <p key={i} className="text-[13px] text-center leading-relaxed" style={{ color: i === 0 ? '#9a9aaa' : '#7a7a8a' }}>
              {txt}
            </p>
          ))}
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === step ? '#c9a84c' : i < step ? '#c9a84c44' : '#2a2a3a',
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
