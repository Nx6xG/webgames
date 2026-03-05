'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Content rendered inside the tooltip bubble */
  content: ReactNode;
  children: ReactNode;
  /** Preferred placement. Falls back to opposite if clipped. */
  placement?: 'top' | 'bottom';
  /** Extra class on the outer wrapper span */
  className?: string;
}

/**
 * Lightweight portal-rendered tooltip.
 * - Desktop: shows on hover + focus.
 * - Mobile: toggles on tap (tap outside closes).
 * - Keyboard: focus shows, Escape hides.
 * - Accessible: aria-describedby + role="tooltip".
 * - Renders into document.body via portal — never clipped by overflow.
 */
export function Tooltip({ content, children, placement = 'top', className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [side, setSide] = useState(placement);

  useEffect(() => { setMounted(true); }, []);

  // Position the tooltip relative to the trigger using getBoundingClientRect
  const reposition = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;

    const triggerRect = wrap.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 6;

    // Decide side
    let useSide = placement;
    if (placement === 'top' && triggerRect.top - tipRect.height - gap < 4) {
      useSide = 'bottom';
    } else if (placement === 'bottom' && triggerRect.bottom + tipRect.height + gap > window.innerHeight - 4) {
      useSide = 'top';
    }
    setSide(useSide);

    // Vertical
    let top: number;
    if (useSide === 'top') {
      top = triggerRect.top - tipRect.height - gap + window.scrollY;
    } else {
      top = triggerRect.bottom + gap + window.scrollY;
    }

    // Horizontal — center on trigger, clamp to viewport
    let left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2 + window.scrollX;
    const minLeft = 4 + window.scrollX;
    const maxLeft = window.innerWidth - tipRect.width - 4 + window.scrollX;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    setPos({ top, left });
  }, [placement]);

  // Reposition on open and on scroll/resize while open
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    // Defer one frame so tipRef is measured after portal mount
    const raf = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(raf);
  }, [open, mounted, reposition]);

  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, reposition]);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`inline-flex ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>

      {open && mounted && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          style={{ position: 'absolute', top: pos.top, left: pos.left }}
          className="z-[99999] w-max max-w-[240px] px-2.5 py-2 rounded-lg border border-zinc-700/80 bg-zinc-900/95 backdrop-blur-md shadow-xl text-left pointer-events-none leading-snug"
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
}
