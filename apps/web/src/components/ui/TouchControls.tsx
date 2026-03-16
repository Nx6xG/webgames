'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type TouchControlLayout =
  | 'dpad'            // up/down/left/right arrows
  | 'dpad-horizontal' // left/right arrows only
  | 'leftright-action' // left/right + action button (space)
  | 'updown'          // up/down arrows only
  | 'tap';            // single tap button (space)

export interface TouchControlsProps {
  /** Which layout to render */
  layout: TouchControlLayout;
  /** Label for the action button (used in leftright-action and tap layouts) */
  actionLabel?: string;
  /** Additional buttons to render (e.g. pause) */
  extraButtons?: Array<{
    label: string;
    onPress: () => void;
  }>;
  /** Whether controls are disabled */
  disabled?: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function dispatchKey(key: string, type: 'keydown' | 'keyup') {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key,
      code: keyToCode(key),
      bubbles: true,
      cancelable: true,
    }),
  );
}

function keyToCode(key: string): string {
  switch (key) {
    case 'ArrowUp': return 'ArrowUp';
    case 'ArrowDown': return 'ArrowDown';
    case 'ArrowLeft': return 'ArrowLeft';
    case 'ArrowRight': return 'ArrowRight';
    case ' ': return 'Space';
    default: return `Key${key.toUpperCase()}`;
  }
}

/* ─── Touch Button ───────────────────────────────────────────────────────── */

function TouchBtn({
  label,
  keyName,
  onPress,
  className = '',
  disabled,
}: {
  label: string;
  /** If provided, dispatches keyboard events for this key on press/release */
  keyName?: string;
  /** Direct callback (used when no key dispatch is needed) */
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const activeRef = useRef(false);

  const handleDown = useCallback(
    (e: React.PointerEvent | React.TouchEvent) => {
      e.preventDefault();
      if (disabled || activeRef.current) return;
      activeRef.current = true;
      if (keyName) dispatchKey(keyName, 'keydown');
      if (onPress) onPress();
    },
    [keyName, onPress, disabled],
  );

  const handleUp = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    if (keyName) dispatchKey(keyName, 'keyup');
  }, [keyName]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current && keyName) {
        dispatchKey(keyName, 'keyup');
      }
    };
  }, [keyName]);

  return (
    <button
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onPointerCancel={handleUp}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      className={`
        select-none touch-manipulation
        bg-[var(--card,#27272a)] active:bg-zinc-600
        border border-[var(--border,#3f3f46)]
        text-[var(--fg,#e4e4e7)] text-sm font-semibold rounded-xl
        transition-colors duration-75
        disabled:opacity-30
        ${className}
      `}
    >
      {label}
    </button>
  );
}

/* ─── D-Pad Layout ───────────────────────────────────────────────────────── */

function DPad({ disabled }: { disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1 w-[144px]">
      <div />
      <TouchBtn label="▲" keyName="ArrowUp" disabled={disabled} className="py-3 text-base" />
      <div />
      <TouchBtn label="◀" keyName="ArrowLeft" disabled={disabled} className="py-3 text-base" />
      <div />
      <TouchBtn label="▶" keyName="ArrowRight" disabled={disabled} className="py-3 text-base" />
      <div />
      <TouchBtn label="▼" keyName="ArrowDown" disabled={disabled} className="py-3 text-base" />
      <div />
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function TouchControls({
  layout,
  actionLabel = '●',
  extraButtons,
  disabled,
}: TouchControlsProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window || navigator.maxTouchPoints > 0,
    );
  }, []);

  if (!isTouchDevice) return null;

  return (
    <div className="shrink-0 flex flex-col items-center gap-1.5 w-full sm:hidden">
      {/* Main controls */}
      {layout === 'dpad' && <DPad disabled={disabled} />}

      {layout === 'dpad-horizontal' && (
        <div className="flex gap-2 justify-center">
          <TouchBtn label="◀" keyName="ArrowLeft" disabled={disabled} className="px-6 py-3 text-base" />
          <TouchBtn label="▶" keyName="ArrowRight" disabled={disabled} className="px-6 py-3 text-base" />
        </div>
      )}

      {layout === 'updown' && (
        <div className="flex gap-2 justify-center">
          <TouchBtn label="▲" keyName="ArrowUp" disabled={disabled} className="px-6 py-3 text-base" />
          <TouchBtn label="▼" keyName="ArrowDown" disabled={disabled} className="px-6 py-3 text-base" />
        </div>
      )}

      {layout === 'leftright-action' && (
        <div className="flex gap-2 justify-center w-full max-w-xs">
          <TouchBtn label="◀" keyName="ArrowLeft" disabled={disabled} className="flex-1 py-3 text-base" />
          <TouchBtn label={actionLabel} keyName=" " disabled={disabled} className="flex-[2] py-3 text-base" />
          <TouchBtn label="▶" keyName="ArrowRight" disabled={disabled} className="flex-1 py-3 text-base" />
        </div>
      )}

      {layout === 'tap' && (
        <div className="flex gap-2 justify-center w-full max-w-xs">
          <TouchBtn label={actionLabel} keyName=" " disabled={disabled} className="flex-1 py-3 text-base" />
        </div>
      )}

      {/* Extra buttons (pause, restart, etc.) */}
      {extraButtons && extraButtons.length > 0 && (
        <div className="flex gap-2 justify-center">
          {extraButtons.map((btn, i) => (
            <TouchBtn
              key={i}
              label={btn.label}
              onPress={btn.onPress}
              disabled={disabled}
              className="px-4 py-2 text-xs"
            />
          ))}
        </div>
      )}
    </div>
  );
}
