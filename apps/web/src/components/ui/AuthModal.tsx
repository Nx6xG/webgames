'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/LanguageProvider';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signInWithEmail, verifyOtp } = useAuth();
  const { t } = useI18n();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Lock scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus inputs
  useEffect(() => {
    if (!open || !mounted) return;
    const id = setTimeout(() => {
      if (step === 'email') emailInputRef.current?.focus();
      else otpInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [open, mounted, step]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError(null);
    const result = await signInWithEmail(email.trim());
    setSending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setStep('code');
      setOtp('');
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || verifying) return;
    setVerifying(true);
    setError(null);
    const result = await verifyOtp(email.trim(), otp.trim());
    setVerifying(false);
    if (result.error) {
      setError(result.error);
    } else {
      // Success — session is set via onAuthStateChange
      handleClose();
    }
  }

  async function handleResend() {
    setSending(true);
    setError(null);
    const result = await signInWithEmail(email.trim());
    setSending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setOtp('');
    }
  }

  function handleClose() {
    setEmail('');
    setOtp('');
    setStep('email');
    setError(null);
    setSending(false);
    setVerifying(false);
    onClose();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) handleClose(); }}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[min(92vw,380px)] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-100">{t('auth.signIn')}</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'code' ? (
          /* OTP code entry */
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div className="text-center space-y-1">
              <div className="text-2xl">📧</div>
              <p className="text-sm text-zinc-200">{t('auth.checkEmail')}</p>
              <p className="text-[10px] text-zinc-500">{email}</p>
            </div>

            <div>
              <label htmlFor="auth-otp" className="block text-[10px] text-zinc-500 font-medium mb-1">
                {t('auth.codeLabel')}
              </label>
              <input
                ref={otpInputRef}
                id="auth-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-center text-lg font-mono font-bold text-zinc-100 tracking-[0.3em] placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-[11px] text-rose-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={verifying || otp.length < 6}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
            >
              {verifying ? '…' : t('auth.verify')}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStep('email'); setError(null); }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {t('auth.changeEmail')}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {sending ? '…' : t('auth.resend')}
              </button>
            </div>
          </form>
        ) : (
          /* Email form */
          <form onSubmit={handleSendCode} className="space-y-3">
            <p className="text-[11px] text-zinc-400">{t('auth.guestHint')}</p>

            <div>
              <label htmlFor="auth-email" className="block text-[10px] text-zinc-500 font-medium mb-1">
                {t('auth.emailLabel')}
              </label>
              <input
                ref={emailInputRef}
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-[11px] text-rose-400">{t('auth.syncError')}: {error}</p>
            )}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
            >
              {sending ? '…' : t('auth.sendCode')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
