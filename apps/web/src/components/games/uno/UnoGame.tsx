'use client';

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { UnoState, UnoCard, UnoColor, RoomVisibility } from 'shared';
import { UNO_TARGET_SCORES, UNO_DEFAULT_TARGET, UNO_DEFAULT_RULES } from 'shared';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { WaitingForConnectionOverlay } from '@/components/WaitingForConnectionOverlay';
import { ChatPanelWithProfile as ChatPanel } from '@/components/chat/ChatPanelWithProfile';
import { NicknameEditor } from '@/components/NicknameEditor';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { SpectatorBanner } from '@/components/ui/SpectatorBanner';
import { ReconnectBanner } from '@/components/ui/ReconnectBanner';

// ── Compact viewport ────────────────────────────────────────────────────────

const MQ = '(max-height: 800px)';
function subscribeCompact(cb: () => void) {
  const mql = window.matchMedia(MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function getCompact() { return window.matchMedia(MQ).matches; }
function getCompactServer() { return false; }
function useCompact() { return useSyncExternalStore(subscribeCompact, getCompact, getCompactServer); }

// ── Color systems ───────────────────────────────────────────────────────────
// Rich, saturated card colors that pop against the dark felt

const CARD_COLORS: Record<UnoColor, { bg: string; text: string; shadow: string; glow: string; accent: string; darkBg: string }> = {
  red:    { bg: '#ef4444', text: '#fff',    shadow: 'rgba(239,68,68,0.45)',  glow: 'rgba(248,113,113,0.15)', accent: '#fca5a5', darkBg: '#991b1b' },
  yellow: { bg: '#facc15', text: '#1c1917', shadow: 'rgba(250,204,21,0.4)',  glow: 'rgba(253,224,71,0.12)',  accent: '#fef08a', darkBg: '#854d0e' },
  green:  { bg: '#22c55e', text: '#fff',    shadow: 'rgba(34,197,94,0.45)',  glow: 'rgba(74,222,128,0.15)',  accent: '#86efac', darkBg: '#166534' },
  blue:   { bg: '#3b82f6', text: '#fff',    shadow: 'rgba(59,130,246,0.45)', glow: 'rgba(96,165,250,0.15)',  accent: '#93c5fd', darkBg: '#1e40af' },
};

const COLOR_LABEL: Record<UnoColor, string> = {
  red: 'Rot', yellow: 'Gelb', green: 'Grün', blue: 'Blau',
};

// ── Card symbol helpers ─────────────────────────────────────────────────────

function cardSymbol(card: UnoCard): string {
  if (card.type === 'number') return String(card.value);
  if (card.type === 'skip') return '⊘';
  if (card.type === 'reverse') return '⇄';
  if (card.type === 'draw2') return '+2';
  if (card.type === 'wild') return 'W';
  if (card.type === 'wild4') return '+4';
  return '?';
}

function cardTypeName(card: UnoCard): string {
  if (card.type === 'number') return String(card.value);
  if (card.type === 'skip') return 'Skip';
  if (card.type === 'reverse') return 'Reverse';
  if (card.type === 'draw2') return 'Draw 2';
  if (card.type === 'wild') return 'Wild';
  if (card.type === 'wild4') return 'Wild +4';
  return '';
}

// ── SVG card decoration ─────────────────────────────────────────────────────

function CardOval({ color, large }: { color: string; large?: boolean }) {
  const w = large ? 56 : 32;
  const h = large ? 80 : 48;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ opacity: 1 }}
    >
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={w / 2 - 1}
        ry={h / 2 - 1}
        fill="rgba(255,255,255,0.25)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
        transform={`rotate(-15, ${w / 2}, ${h / 2})`}
      />
    </svg>
  );
}

// ── Card Face ───────────────────────────────────────────────────────────────
// Physical card with real depth: rounded corners, inner oval, corner pips,
// colored drop shadow, and tactile hover lift

function CardFace({
  card,
  playable,
  selected,
  onClick,
  compact,
  large,
  style,
}: {
  card: UnoCard;
  playable: boolean;
  selected: boolean;
  onClick?: () => void;
  compact: boolean;
  large?: boolean;
  style?: React.CSSProperties;
}) {
  const isWild = card.type === 'wild' || card.type === 'wild4';
  const sym = cardSymbol(card);
  const cInfo = !isWild && card.color ? CARD_COLORS[card.color] : null;

  // Dimensions
  const w = large ? 110 : compact ? 48 : 62;
  const h = large ? 160 : compact ? 72 : 94;
  const radius = large ? 14 : compact ? 8 : 10;
  const fontSize = large ? 40 : compact ? 16 : 22;
  const cornerFontSize = large ? 14 : compact ? 7 : 9;

  const bgColor = isWild ? undefined : cInfo!.bg;
  const textColor = isWild ? '#fff' : cInfo!.text;
  const shadowColor = isWild ? 'rgba(139,92,246,0.35)' : cInfo!.shadow;

  return (
    <button
      onClick={onClick}
      disabled={!playable && !onClick}
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: isWild
          ? 'conic-gradient(from 45deg, #dc2626, #eab308, #16a34a, #2563eb, #dc2626)'
          : bgColor,
        color: textColor,
        fontSize,
        boxShadow: selected
          ? `0 8px 24px ${shadowColor}, 0 0 0 2px rgba(129,140,248,0.7), inset 0 1px 0 rgba(255,255,255,0.2)`
          : playable
            ? `0 4px 14px ${shadowColor}, inset 0 1px 0 rgba(255,255,255,0.15)`
            : `0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`,
        opacity: 1,
        filter: (!playable && onClick) ? 'brightness(0.55) saturate(0.5)' : undefined,
        cursor: playable ? 'pointer' : onClick ? 'not-allowed' : 'default',
        transform: selected ? 'translateY(-16px) scale(1.08)' : undefined,
        ...style,
      }}
      className={`
        relative font-black flex items-center justify-center
        select-none shrink-0 border-0 outline-none
        transition-[box-shadow,filter,opacity] duration-200
        ${playable && !selected ? 'uno-card-playable' : ''}
      `}
    >
      {/* Card surface texture — subtle inner border */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 2,
          borderRadius: radius - 2,
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      />

      {/* White oval center */}
      <CardOval color={isWild ? '#fff' : cInfo!.bg} large={large} />

      {/* Corner pips */}
      <span
        className="absolute font-black leading-none"
        style={{
          top: large ? 6 : 4,
          left: large ? 8 : 5,
          fontSize: cornerFontSize,
          opacity: 1,
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {sym}
      </span>
      <span
        className="absolute font-black leading-none rotate-180"
        style={{
          bottom: large ? 6 : 4,
          right: large ? 8 : 5,
          fontSize: cornerFontSize,
          opacity: 1,
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {sym}
      </span>

      {/* Center symbol */}
      <span
        className="relative z-10 font-black"
        style={{
          fontSize,
          textShadow: '0 2px 4px rgba(0,0,0,0.4)',
          lineHeight: 1,
        }}
      >
        {sym}
      </span>
    </button>
  );
}

// ── Card Back ───────────────────────────────────────────────────────────────
// Styled like a real card back: dark with a decorative diamond pattern center

function CardBack({ compact, w: width, h: height }: { compact: boolean; w?: number; h?: number }) {
  const bw = width ?? (compact ? 32 : 44);
  const bh = height ?? (compact ? 46 : 64);
  const r = compact ? 5 : 7;
  return (
    <div
      className="shrink-0 relative overflow-hidden flex items-center justify-center"
      style={{
        width: bw,
        height: bh,
        borderRadius: r,
        background: 'linear-gradient(145deg, #2d2d31 0%, #232326 50%, #1a1a1d 100%)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        border: '1px solid rgba(82,82,91,0.7)',
      }}
    >
      {/* Inner decorative border */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 3,
          borderRadius: r - 2,
          border: '1.5px solid rgba(161,98,7,0.25)',
          background: 'linear-gradient(135deg, rgba(161,98,7,0.06) 0%, transparent 50%, rgba(161,98,7,0.06) 100%)',
        }}
      />
      {/* Center diamond motif */}
      <svg viewBox="0 0 20 20" width={bw * 0.4} height={bh * 0.3} className="relative z-10 opacity-20">
        <path d="M10 2 L18 10 L10 18 L2 10 Z" fill="none" stroke="#a16207" strokeWidth="1.5" />
        <path d="M10 6 L14 10 L10 14 L6 10 Z" fill="#a16207" opacity="0.3" />
      </svg>
    </div>
  );
}

// ── Active Color Ring ───────────────────────────────────────────────────────
// Glowing colored ring around the discard pile area

function ActiveColorIndicator({ color, compact }: { color: UnoColor; compact: boolean }) {
  const c = CARD_COLORS[color];
  const size = compact ? 40 : 52;
  return (
    <div
      className="flex items-center justify-center transition-all duration-500"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: c.bg,
        boxShadow: `0 0 12px ${c.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
        border: `2.5px solid ${c.accent}`,
      }}
    >
      <span
        className="font-black uppercase tracking-wide"
        style={{
          fontSize: compact ? 8 : 10,
          color: c.text,
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}
      >
        {COLOR_LABEL[color]}
      </span>
    </div>
  );
}

// ── Color Picker Overlay ────────────────────────────────────────────────────

function ColorPicker({ onPick, pt }: { onPick: (color: UnoColor) => void; pt: (k: string) => string }) {
  const colors: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div
        className="flex flex-col items-center gap-6 p-10 rounded-3xl"
        style={{
          background: 'linear-gradient(145deg, rgba(39,39,42,0.97) 0%, rgba(24,24,27,0.98) 100%)',
          border: '1px solid rgba(63,63,70,0.5)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)',
          animation: 'uno-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <p className="text-lg font-black text-zinc-100 tracking-tight">{pt('uno.chooseColor')}</p>
        <div className="grid grid-cols-2 gap-5">
          {colors.map((clr) => {
            const c = CARD_COLORS[clr];
            return (
              <button
                key={clr}
                onClick={() => onPick(clr)}
                className="cursor-pointer transition-all duration-200 hover:scale-110 active:scale-100"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 20,
                  background: `linear-gradient(145deg, ${c.bg}, ${c.darkBg})`,
                  border: `2px solid ${c.accent}`,
                  boxShadow: `0 8px 24px ${c.shadow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                  color: c.text,
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                {COLOR_LABEL[clr]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Opponent Zone ───────────────────────────────────────────────────────────
// Compact opponent panel with card fan, UNO danger state, and turn ring

function OpponentZone({
  player,
  index,
  isCurrent,
  isFinished,
  compact,
  pt,
}: {
  player: UnoState['players'][number];
  index: number;
  isCurrent: boolean;
  isFinished: boolean;
  compact: boolean;
  pt: (k: string) => string;
}) {
  const hasUno = player.handCount === 1 && !isFinished;
  const fanCount = Math.min(player.handCount, 9);
  const cardW = compact ? 18 : 22;
  const cardH = compact ? 26 : 32;

  return (
    <div
      className="relative flex flex-col items-center gap-1 transition-all duration-300"
      style={{
        minWidth: compact ? 100 : 120,
        padding: compact ? '8px 12px' : '10px 16px',
        borderRadius: 14,
        background: isCurrent
          ? 'linear-gradient(145deg, rgba(79,70,229,0.12) 0%, rgba(49,46,129,0.08) 100%)'
          : 'rgba(24,24,27,0.5)',
        border: isCurrent
          ? '1.5px solid rgba(129,140,248,0.35)'
          : hasUno
            ? '1.5px solid rgba(244,63,94,0.35)'
            : '1px solid rgba(63,63,70,0.3)',
        boxShadow: isCurrent
          ? '0 0 20px rgba(99,102,241,0.1)'
          : hasUno
            ? '0 0 16px rgba(244,63,94,0.12)'
            : 'none',
      }}
    >
      {/* Turn pulse ring */}
      {isCurrent && (
        <div
          className="absolute -inset-px rounded-[14px] pointer-events-none"
          style={{
            border: '1.5px solid rgba(129,140,248,0.25)',
            animation: 'uno-glow-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Name */}
      <span
        className="text-xs font-semibold truncate max-w-[90px]"
        style={{ color: isCurrent ? '#a5b4fc' : '#a1a1aa' }}
      >
        {player.nickname || `Player ${index + 1}`}
      </span>

      {/* Card fan */}
      <div className="relative flex items-center justify-center" style={{ height: cardH + 8, width: Math.max(60, fanCount * 6 + cardW) }}>
        {Array.from({ length: fanCount }).map((_, j) => {
          const angle = (j - (fanCount - 1) / 2) * (fanCount > 5 ? 6 : 8);
          const yOff = Math.abs(j - (fanCount - 1) / 2) * 1.5;
          return (
            <div
              key={j}
              className="absolute"
              style={{
                width: cardW,
                height: cardH,
                borderRadius: 4,
                background: 'linear-gradient(145deg, #3f3f46, #27272a)',
                border: '1px solid rgba(82,82,91,0.7)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(${yOff}px)`,
                transformOrigin: 'center bottom',
              }}
            >
              {/* Tiny back pattern */}
              <div
                className="absolute"
                style={{
                  inset: 2,
                  borderRadius: 2,
                  border: '0.5px solid rgba(161,98,7,0.25)',
                }}
              />
            </div>
          );
        })}
        {player.handCount > 9 && (
          <span
            className="absolute -right-1 -bottom-1 flex items-center justify-center text-[8px] font-bold z-10"
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: '#3f3f46',
              color: '#d4d4d8',
              border: '1px solid rgba(82,82,91,0.6)',
            }}
          >
            {player.handCount}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-medium" style={{ color: '#a1a1aa' }}>
          {player.handCount} {pt('uno.cards')} · {player.matchScore} {pt('uno.score')}
        </span>
        {player.calledUno && (
          <span
            className="font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              fontSize: 10,
              background: 'rgba(234,179,8,0.18)',
              color: '#fbbf24',
              border: '1.5px solid rgba(234,179,8,0.3)',
              boxShadow: '0 0 8px rgba(234,179,8,0.15)',
            }}
          >
            UNO
          </span>
        )}
      </div>

      {/* UNO danger */}
      {hasUno && !player.calledUno && (
        <span
          className="font-black uppercase tracking-wider px-3 py-1 rounded-full"
          style={{
            fontSize: 11,
            background: 'rgba(244,63,94,0.18)',
            color: '#fb7185',
            border: '1.5px solid rgba(244,63,94,0.35)',
            boxShadow: '0 0 12px rgba(244,63,94,0.2)',
            animation: 'uno-uno-throb 1.5s ease-in-out infinite',
          }}
        >
          UNO!
        </span>
      )}
    </div>
  );
}

// ── Draw Pile Stack ─────────────────────────────────────────────────────────

function DrawPileStack({ compact, isMyTurn, mustDraw, canDraw = true, onClick }: { compact: boolean; isMyTurn: boolean; mustDraw?: boolean; canDraw?: boolean; onClick: () => void }) {
  const w = compact ? 62 : 76;
  const h = compact ? 92 : 112;
  const r = compact ? 10 : 12;
  const enabled = isMyTurn && canDraw;
  const highlighted = isMyTurn && mustDraw;

  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`relative group transition-all duration-200 ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      style={{ opacity: enabled ? 1 : 0.4 }}
    >
      {/* Pulsing highlight ring when must draw */}
      {highlighted && (
        <div
          className="absolute -inset-3 rounded-2xl pointer-events-none z-0"
          style={{
            border: '2px solid rgba(251,191,36,0.5)',
            boxShadow: '0 0 20px rgba(251,191,36,0.25), inset 0 0 20px rgba(251,191,36,0.08)',
            animation: 'uno-glow-pulse 1.2s ease-in-out infinite',
          }}
        />
      )}
      {/* Stack layers */}
      {[3, 2, 1].map((layer) => (
        <div
          key={layer}
          className="absolute"
          style={{
            width: w,
            height: h,
            borderRadius: r,
            background: 'linear-gradient(145deg, #1f1f23, #18181b)',
            border: '1px solid rgba(63,63,70,0.4)',
            bottom: layer * 2,
            right: layer * 2,
            opacity: 0.5 + layer * 0.15,
          }}
        />
      ))}
      {/* Top card */}
      <div
        className={`relative overflow-hidden flex items-center justify-center transition-all duration-200 ${
          enabled ? 'group-hover:scale-[1.04] group-hover:-translate-y-1 group-active:scale-[0.98]' : ''
        }`}
        style={{
          width: w,
          height: h,
          borderRadius: r,
          background: 'linear-gradient(145deg, #323237 0%, #232326 50%, #18181b 100%)',
          border: '1px solid rgba(82,82,91,0.7)',
          boxShadow: highlighted
            ? '0 4px 16px rgba(0,0,0,0.5), 0 0 24px rgba(251,191,36,0.2), 0 0 8px rgba(251,191,36,0.15)'
            : isMyTurn
              ? '0 4px 16px rgba(0,0,0,0.5), 0 0 20px rgba(99,102,241,0.08)'
              : '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {/* Inner decorative frame */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: 5,
            borderRadius: r - 3,
            border: '1.5px solid rgba(161,98,7,0.2)',
            background: 'linear-gradient(135deg, rgba(161,98,7,0.04) 0%, transparent 50%, rgba(161,98,7,0.04) 100%)',
          }}
        />
        {/* Center diamond */}
        <svg viewBox="0 0 24 24" width={w * 0.35} height={h * 0.25} className="relative z-10 opacity-25">
          <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="#a16207" strokeWidth="1.5" />
          <path d="M12 7 L17 12 L12 17 L7 12 Z" fill="#a16207" opacity="0.4" />
        </svg>
        {/* Hover glow */}
        {isMyTurn && (
          <div
            className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ boxShadow: 'inset 0 0 20px rgba(99,102,241,0.1)' }}
          />
        )}
      </div>
    </button>
  );
}

// ── CSS keyframes ───────────────────────────────────────────────────────────

const ANIM_STYLES = `
@keyframes uno-pop {
  0%   { transform: scale(0.8); opacity: 0; }
  50%  { transform: scale(1.03); }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes uno-confetti-fall {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  75%  { opacity: 0.8; }
  100% { transform: translateY(500px) rotate(480deg); opacity: 0; }
}
@keyframes uno-glow-pulse {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 0.8; }
}
@keyframes uno-card-enter {
  0%   { transform: translateY(20px) scale(0.9) rotate(-5deg); opacity: 0; }
  100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
}
@keyframes uno-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes uno-playable-idle {
  0%, 100% { transform: translateY(0)    scale(1); }
  50%      { transform: translateY(-4px) scale(1.02); }
}
.uno-card-playable {
  animation: uno-playable-idle 2.5s ease-in-out infinite;
}
.uno-card-playable:hover {
  animation: none !important;
  transform: translateY(-10px) scale(1.05) !important;
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
}
.uno-card-playable:active {
  animation: none !important;
  transform: translateY(-6px) scale(1.02) !important;
}
@keyframes uno-uno-throb {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(239,68,68,0.3); }
  50%      { transform: scale(1.06); box-shadow: 0 0 36px rgba(239,68,68,0.5), 0 0 60px rgba(245,158,11,0.2); }
}
@keyframes uno-direction-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes uno-announce-in {
  0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
  50%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
  70%  { transform: scale(0.95) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes uno-announce-out {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.7) translateY(-30px); opacity: 0; }
}
@keyframes uno-announce-glow {
  0%, 100% { text-shadow: 0 0 20px rgba(239,68,68,0.6), 0 0 60px rgba(239,68,68,0.3), 0 2px 4px rgba(0,0,0,0.5); }
  50%      { text-shadow: 0 0 40px rgba(239,68,68,0.9), 0 0 80px rgba(239,68,68,0.5), 0 0 120px rgba(245,158,11,0.3), 0 2px 4px rgba(0,0,0,0.5); }
}
`;

// ── Main component ──────────────────────────────────────────────────────────

export function UnoGame({ wsUrl, gameId, initialRoomCode, quickPlay: isQuickPlay }: GameComponentProps) {
  const mp = useMultiplayer<UnoState>(wsUrl, gameId);
  const gs = mp.gameState;
  const myIdx = mp.playerIndex;
  const { t } = useI18n();
  const router = useRouter();
  const compact = useCompact();
  const ach = useAchievements('uno', mp.roomCode);

  // ── Lobby state ───────────────────────────────────────────────────────────
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibility>('private');
  const [roomName, setRoomName] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [targetScore, setTargetScore] = useState(UNO_DEFAULT_TARGET);
  const [stackDraw2, setStackDraw2] = useState(UNO_DEFAULT_RULES.stackDraw2);
  const [stackDraw4, setStackDraw4] = useState(UNO_DEFAULT_RULES.stackDraw4);
  const [allowDraw2OnDraw4, setAllowDraw2OnDraw4] = useState(UNO_DEFAULT_RULES.allowDraw2OnDraw4);
  const [allowDraw4OnDraw2, setAllowDraw4OnDraw2] = useState(UNO_DEFAULT_RULES.allowDraw4OnDraw2);
  const [playDrawnCard, setPlayDrawnCard] = useState(UNO_DEFAULT_RULES.playDrawnCardImmediately);
  const [drawUntilPlayable, setDrawUntilPlayable] = useState(UNO_DEFAULT_RULES.drawUntilPlayable);
  const [forcedPlay, setForcedPlay] = useState(UNO_DEFAULT_RULES.forcedPlay);
  const autoJoined = useRef(false);

  // ── Game UI state ─────────────────────────────────────────────────────────
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevTotalRef = useRef<number | null>(null);

  // ── UNO announcement overlay ─────────────────────────────────────────────
  const [unoAnnouncement, setUnoAnnouncement] = useState<{ nickname: string; timestamp: number } | null>(null);
  const [unoAnnounceFading, setUnoAnnounceFading] = useState(false);
  const prevLastActionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!gs?.lastAction || gs.lastAction === prevLastActionRef.current) return;
    prevLastActionRef.current = gs.lastAction;
    const match = gs.lastAction.match(/^(.+?) called UNO!$/);
    if (match) {
      setUnoAnnouncement({ nickname: match[1], timestamp: Date.now() });
      setUnoAnnounceFading(false);
    }
  }, [gs?.lastAction]);

  useEffect(() => {
    if (!unoAnnouncement) return;
    const fadeTimer = setTimeout(() => setUnoAnnounceFading(true), 2000);
    const clearTimer = setTimeout(() => { setUnoAnnouncement(null); setUnoAnnounceFading(false); }, 2500);
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
  }, [unoAnnouncement]);

  // ── End overlay ───────────────────────────────────────────────────────────
  const lastFinishKeyRef = useRef('');
  const [endOverlay, setEndOverlay] = useState<{ kind: 'round_end' | 'match_end'; iWon: boolean; winnerNick: string | null; points: number } | null>(null);

  // ── Auto-join / quick-play ────────────────────────────────────────────────
  useEffect(() => {
    if (mp.connection === 'connected' && initialRoomCode && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.joinRoom(initialRoomCode);
    }
  }, [mp.connection, initialRoomCode, mp.phase, mp.joinRoom]);

  useEffect(() => {
    if (mp.connection === 'connected' && isQuickPlay && !autoJoined.current && mp.phase === 'lobby') {
      autoJoined.current = true;
      mp.quickPlay();
    }
  }, [mp.connection, isQuickPlay, mp.phase, mp.quickPlay]);

  useEffect(() => {
    if (mp.roomCode && isQuickPlay) {
      router.replace(`/games/uno?room=${mp.roomCode}`);
    }
  }, [mp.roomCode, isQuickPlay, router]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  const prevPhaseRef = useRef(mp.phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'ended' && mp.phase !== 'ended') ach.reset();
    prevPhaseRef.current = mp.phase;
  }, [mp.phase, ach]);

  useEffect(() => {
    if (mp.phase === 'playing' && !mp.isSpectator && mp.gameState?.status === 'ongoing') ach.trackPlay();
  }, [mp.phase, mp.isSpectator, ach, mp.gameState?.status]);

  const finishKey = (gs?.phase === 'match_end' || gs?.phase === 'round_end') && gs?.roundWinner && !mp.isSpectator && myIdx !== null
    ? `${mp.roomCode ?? ''}|${gs.phase}|${gs.roundNumber}|${gs.roundWinner}`
    : '';

  useEffect(() => {
    if (!finishKey) {
      lastFinishKeyRef.current = '';
      setEndOverlay(null);
      return;
    }
    if (finishKey === lastFinishKeyRef.current) return;
    lastFinishKeyRef.current = finishKey;
    const roundWinnerToken = gs?.roundWinner;
    const iWon = roundWinnerToken != null && myIdx !== null && gs!.playerIds[myIdx] === roundWinnerToken;
    const winnerPlayer = gs?.players.find(p => p.token === roundWinnerToken);
    const kind = gs?.phase === 'match_end' ? 'match_end' : 'round_end';
    setEndOverlay({ kind, iWon: !!iWon, winnerNick: winnerPlayer?.nickname ?? null, points: gs?.roundPoints ?? 0 });
    if (iWon && kind === 'match_end') {
      const wild4Finish = gs?.topCard?.type === 'wild4';
      ach.trackWin(wild4Finish ? { unoWildDraw4Finish: true } : undefined);
    }
    if (!iWon && kind === 'match_end') ach.trackLoss();
  }, [finishKey, gs, myIdx, ach]);

  // ── Chat unread tracking ─────────────────────────────────────────────────
  useEffect(() => {
    const total = mp.roomMessages.length + mp.globalMessages.length;
    if (prevTotalRef.current === null) { prevTotalRef.current = total; return; }
    if (!chatOpen && total > prevTotalRef.current) {
      setUnread((u) => u + (total - prevTotalRef.current!));
    }
    prevTotalRef.current = total;
  }, [mp.roomMessages.length, mp.globalMessages.length, chatOpen]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const myHand: UnoCard[] = gs && myIdx !== null ? (gs.hands[myIdx] ?? []) : [];
  const isMyTurn = !mp.isSpectator && gs !== null && gs.phase === 'playing' && myIdx !== null && gs.currentTurn === gs.playerIds[myIdx];
  const activeColor = gs?.chosenColor ?? gs?.topCard?.color ?? null;

  const canPlayCard = useCallback((card: UnoCard): boolean => {
    if (!gs || !isMyTurn) return false;

    // Drawn-card window: only the drawn card may be played
    if (gs.drawnCardId !== null) {
      return card.id === gs.drawnCardId;
    }

    // Pending draw stack: only stackable cards allowed
    if (gs.pendingDraw > 0 && gs.pendingDrawSource) {
      const src = gs.pendingDrawSource;
      const rules = gs.rules;
      if (src === 'draw2') {
        if (card.type === 'draw2' && rules.stackDraw2) return true;
        if (card.type === 'wild4' && rules.allowDraw4OnDraw2) return true;
        return false;
      }
      // src === 'wild4'
      if (card.type === 'wild4' && rules.stackDraw4) return true;
      if (card.type === 'draw2' && rules.allowDraw2OnDraw4) return true;
      return false;
    }

    // Normal playability
    if (card.type === 'wild' || card.type === 'wild4') return true;
    if (card.color === activeColor) return true;
    if (card.type === 'number' && gs.topCard.type === 'number' && card.value === gs.topCard.value) return true;
    if (card.type !== 'number' && card.type === gs.topCard.type) return true;
    return false;
  }, [gs, isMyTurn, activeColor]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleCardClick(card: UnoCard) {
    if (!canPlayCard(card)) return;
    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingCardId(card.id);
      setShowColorPicker(true);
      return;
    }
    mp.sendAction({ type: 'UNO_PLAY_CARD', cardId: card.id });
    setSelectedCardId(null);
  }

  function handleColorPick(color: UnoColor) {
    if (pendingCardId == null) return;
    mp.sendAction({ type: 'UNO_PLAY_CARD', cardId: pendingCardId, chosenColor: color });
    setShowColorPicker(false);
    setPendingCardId(null);
    setSelectedCardId(null);
  }

  function handleDraw() {
    mp.sendAction({ type: 'UNO_DRAW_CARD' });
  }

  function handleCallUno() {
    mp.sendAction({ type: 'UNO_CALL_UNO' });
  }

  function handleStart() {
    mp.sendAction({ type: 'UNO_START' });
  }

  // ── Nickname resolver ─────────────────────────────────────────────────────
  function getNickname(token: string | null | undefined): string {
    if (!token || !gs) return '?';
    const pl = gs.players.find(p => p.token === token);
    return pl?.nickname || 'Player';
  }

  const currentPlayerNick = gs?.currentTurn ? getNickname(gs.currentTurn) : '';
  const gapMain = compact ? 'gap-2' : 'gap-4';

  // ── Compute hand fan geometry ─────────────────────────────────────────────
  const handFanAngles = myHand.map((_, i) => {
    const n = myHand.length;
    const maxSpread = Math.min(n * 4, 40);
    return ((i - (n - 1) / 2) / Math.max(n - 1, 1)) * maxSpread;
  });

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLES }} />
      <div className={`grid ${gapMain} lg:grid-cols-[1fr_340px] w-full items-start`}>
        {/* ── Main game area ──────────────────────────────────────────── */}
        <div className={`relative min-w-0 flex flex-col items-center ${gapMain} max-w-3xl mx-auto w-full`}>
          <ReconnectBanner mp={mp} />

          {/* ── UNO announcement overlay ──────────────────────────────── */}
          {unoAnnouncement && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
              style={{
                animation: unoAnnounceFading
                  ? 'uno-announce-out 0.5s ease-in forwards'
                  : 'uno-announce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#fbbf24',
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {unoAnnouncement.nickname}
                </span>
                <span
                  className="font-black"
                  style={{
                    fontSize: 52,
                    color: '#ef4444',
                    letterSpacing: '-0.02em',
                    animation: 'uno-announce-glow 1s ease-in-out infinite',
                    WebkitTextStroke: '1.5px rgba(0,0,0,0.3)',
                  }}
                >
                  UNO!
                </span>
              </div>
            </div>
          )}

          <WaitingForConnectionOverlay
            show={mp.phase === 'waiting' && mp.playerCount < (mp.roomMaxPlayers ?? 2) && !mp.gameState}
            label={t('game.status.waiting')}
          />

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <h2
              className="font-black tracking-tighter text-zinc-100"
              style={{
                fontSize: compact ? 22 : 28,
                letterSpacing: '-0.04em',
              }}
            >
              UNO
            </h2>
            {gs && gs.phase !== 'lobby' && (
              <>
                <span
                  className="font-bold uppercase tracking-wider"
                  style={{
                    fontSize: 9,
                    padding: '3px 10px',
                    borderRadius: 100,
                    background: (gs.phase === 'match_end' || gs.phase === 'round_end')
                      ? 'rgba(16,185,129,0.1)'
                      : 'rgba(99,102,241,0.1)',
                    color: (gs.phase === 'match_end' || gs.phase === 'round_end') ? '#34d399' : '#818cf8',
                    border: `1px solid ${(gs.phase === 'match_end' || gs.phase === 'round_end') ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`,
                  }}
                >
                  {gs.phase === 'match_end' ? t('uno.matchEnd') : gs.phase === 'round_end' ? t('uno.roundEnd') : t('uno.playing')}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: '#71717a' }}>
                  {t('uno.round')} {gs.roundNumber} · {t('uno.target')}: {gs.matchTargetScore}
                </span>
              </>
            )}
            {gs && gs.phase === 'playing' && (
              <span
                className="font-bold"
                style={{
                  color: '#71717a',
                  fontSize: 18,
                }}
                title={gs.direction === 1 ? 'Uhrzeigersinn' : 'Gegen Uhrzeigersinn'}
              >
                {gs.direction === 1 ? '↻' : '↺'}
              </span>
            )}
          </div>

          {/* Spectator banner */}
          {mp.isSpectator && <SpectatorBanner spectatorCount={mp.spectatorCount} />}

          {/* ── In-round scoreboard ─────────────────────────────────── */}
          {gs && gs.phase !== 'lobby' && gs.matchTargetScore > 0 && (
            <div
              className="w-full max-w-md mx-auto flex items-center justify-center gap-3 flex-wrap"
              style={{
                padding: compact ? '6px 10px' : '8px 14px',
                borderRadius: 12,
                background: 'rgba(24,24,27,0.5)',
                border: '1px solid rgba(63,63,70,0.25)',
              }}
            >
              {[...gs.players].sort((a, b) => b.matchScore - a.matchScore).map((p, rank) => {
                const isMe = myIdx !== null && p.token === gs.playerIds[myIdx];
                const isLeading = rank === 0 && p.matchScore > 0;
                return (
                  <div
                    key={p.token}
                    className="flex items-center gap-1.5"
                    style={{
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: isMe ? 'rgba(99,102,241,0.1)' : 'transparent',
                      border: isMe ? '1px solid rgba(129,140,248,0.15)' : '1px solid transparent',
                    }}
                  >
                    {isLeading && <span style={{ fontSize: 10 }}>{'\u{1F451}'}</span>}
                    <span
                      className="font-medium truncate max-w-[80px]"
                      style={{ fontSize: 11, color: isMe ? '#c7d2fe' : '#a1a1aa' }}
                    >
                      {p.nickname || `P${gs.players.indexOf(p) + 1}`}
                    </span>
                    <span
                      className="font-black"
                      style={{
                        fontSize: 12,
                        color: isLeading ? '#fbbf24' : '#71717a',
                      }}
                    >
                      {p.matchScore}
                    </span>
                    <span style={{ fontSize: 9, color: '#52525b' }}>/{gs.matchTargetScore}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Turn status banner ─────────────────────────────────────── */}
          {gs && gs.phase === 'playing' && (
            <div
              className="w-full max-w-sm mx-auto flex flex-col items-center gap-1 transition-all duration-300"
              style={{
                padding: compact ? '8px 14px' : '12px 18px',
                borderRadius: 14,
                background: isMyTurn
                  ? 'linear-gradient(145deg, rgba(79,70,229,0.12) 0%, rgba(49,46,129,0.06) 100%)'
                  : 'rgba(24,24,27,0.4)',
                border: isMyTurn
                  ? '1px solid rgba(129,140,248,0.3)'
                  : '1px solid rgba(63,63,70,0.3)',
                boxShadow: isMyTurn ? '0 0 24px rgba(99,102,241,0.08)' : 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full"
                  style={{
                    width: 7,
                    height: 7,
                    background: isMyTurn ? '#818cf8' : '#52525b',
                    boxShadow: isMyTurn ? '0 0 8px rgba(129,140,248,0.5)' : 'none',
                    animation: isMyTurn ? 'uno-glow-pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                />
                <span
                  className="font-bold"
                  style={{
                    fontSize: compact ? 12 : 13,
                    color: isMyTurn ? '#c7d2fe' : '#a1a1aa',
                  }}
                >
                  {isMyTurn ? (
                    gs.mustDraw
                      ? t('uno.mustDraw')
                      : gs.pendingDraw > 0
                        ? `${t('uno.mustDrawOrStack')} (+${gs.pendingDraw})`
                        : t('uno.yourTurn')
                  ) : (
                    `${currentPlayerNick}${t('game.status.turnSuffix')}`
                  )}
                </span>
              </div>
              {gs.pendingDraw > 0 && (
                <span className="font-semibold" style={{ fontSize: 11, color: '#fb7185' }}>
                  +{gs.pendingDraw} {t('uno.pending')}
                </span>
              )}
            </div>
          )}

          {/* ── Lobby waiting ──────────────────────────────────────────── */}
          {gs && gs.phase === 'lobby' && mp.phase !== 'lobby' && (
            <div className={`flex flex-col items-center ${gapMain} w-full max-w-md`}>
              <div className="flex items-center gap-2" style={{ color: '#fbbf24', fontSize: 14 }}>
                <span
                  className="rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: '#fbbf24',
                    animation: 'uno-glow-pulse 1.5s ease-in-out infinite',
                  }}
                />
                <span className="font-medium">{t('uno.waitingForPlayers')} ({gs.players.length}/{maxPlayers})</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {gs.players.map((p, i) => (
                  <div
                    key={i}
                    className="text-sm font-semibold"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 12,
                      background: 'rgba(39,39,42,0.7)',
                      border: '1px solid rgba(63,63,70,0.4)',
                      color: '#e4e4e7',
                    }}
                  >
                    {p.nickname || `Player ${i + 1}`}
                  </div>
                ))}
              </div>
              {myIdx === 0 && gs.players.length >= 2 && (
                <button
                  onClick={handleStart}
                  className="font-bold text-sm text-white transition-all active:scale-[0.98] cursor-pointer"
                  style={{
                    padding: compact ? '8px 24px' : '12px 32px',
                    borderRadius: 14,
                    background: 'linear-gradient(145deg, #16a34a, #15803d)',
                    boxShadow: '0 4px 16px rgba(22,163,74,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  {t('uno.startGame')}
                </button>
              )}
              {myIdx === 0 && gs.players.length < 2 && (
                <p style={{ color: '#52525b', fontSize: 11 }}>{t('uno.needMorePlayers')}</p>
              )}
            </div>
          )}

          {/* ── Game board ─────────────────────────────────────────────── */}
          {gs && gs.phase !== 'lobby' && (
            <>
              {/* ── Opponents ──────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2 justify-center w-full">
                {gs.players.map((p, i) => {
                  if (i === myIdx && !mp.isSpectator) return null;
                  const isCurrent = gs.currentTurn === p.token && gs.phase === 'playing';
                  return (
                    <OpponentZone
                      key={i}
                      player={p}
                      index={i}
                      isCurrent={isCurrent}
                      isFinished={gs.phase === 'match_end' || gs.phase === 'round_end'}
                      compact={compact}
                      pt={t}
                    />
                  );
                })}
              </div>

              {/* ── Center table (the felt) ─────────────────────────── */}
              <div
                className="relative w-full max-w-lg mx-auto overflow-hidden"
                style={{
                  padding: compact ? '20px 16px' : '32px 24px',
                  borderRadius: 20,
                  background: `
                    radial-gradient(ellipse 70% 50% at 50% 45%, rgba(30,41,28,0.25) 0%, transparent 70%),
                    radial-gradient(ellipse at center, rgba(28,28,32,0.95) 0%, rgba(18,18,20,0.98) 100%)
                  `,
                  border: '1px solid rgba(63,63,70,0.3)',
                  boxShadow: `
                    inset 0 1px 12px rgba(0,0,0,0.2),
                    0 4px 20px rgba(0,0,0,0.3)
                  `,
                }}
              >
                {/* Felt grain texture overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    borderRadius: 20,
                    opacity: 0.03,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: '128px 128px',
                  }}
                />

                {/* Active color ambient glow on felt */}
                {activeColor && (
                  <div
                    className="absolute inset-0 pointer-events-none transition-all duration-700"
                    style={{
                      borderRadius: 20,
                      background: `radial-gradient(circle 140px at 55% 50%, ${CARD_COLORS[activeColor].glow} 0%, transparent 70%)`,
                      animation: 'uno-glow-pulse 3s ease-in-out infinite',
                    }}
                  />
                )}

                {/* Spotlight effect from above */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: -40,
                    left: '30%',
                    right: '30%',
                    height: 80,
                    background: 'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.03) 0%, transparent 70%)',
                    borderRadius: '50%',
                  }}
                />

                <div className={`relative z-10 flex items-center justify-center ${compact ? 'gap-6' : 'gap-10'}`}>
                  {/* Draw pile / Pass button */}
                  <div className="flex flex-col items-center gap-2">
                    {gs.drawnCardId !== null && isMyTurn ? (
                      <button
                        onClick={handleDraw}
                        className="font-bold text-xs cursor-pointer transition-all active:scale-[0.96]"
                        style={{
                          width: compact ? 50 : 60,
                          height: compact ? 70 : 84,
                          borderRadius: compact ? 6 : 8,
                          background: 'linear-gradient(145deg, #3f3f46, #27272a)',
                          border: '1.5px solid rgba(251,191,36,0.4)',
                          boxShadow: '0 0 12px rgba(251,191,36,0.15)',
                          color: '#fbbf24',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {t('uno.pass')}
                      </button>
                    ) : (
                      <DrawPileStack compact={compact} isMyTurn={isMyTurn} mustDraw={isMyTurn && (gs.mustDraw || gs.pendingDraw > 0)} canDraw={!gs.rules.forcedPlay || gs.mustDraw || gs.pendingDraw > 0} onClick={handleDraw} />
                    )}
                    <span
                      className="font-semibold uppercase tracking-wider"
                      style={{
                        fontSize: 9,
                        color: isMyTurn && (gs.mustDraw || gs.pendingDraw > 0) ? '#fbbf24' : '#71717a',
                        letterSpacing: '0.1em',
                        animation: isMyTurn && (gs.mustDraw || gs.pendingDraw > 0) ? 'uno-glow-pulse 1.2s ease-in-out infinite' : 'none',
                      }}
                    >
                      {gs.drawnCardId !== null && isMyTurn ? t('uno.pass') : isMyTurn && gs.pendingDraw > 0 ? `+${gs.pendingDraw} ${t('uno.drawPile')}` : t('uno.drawPile')}
                    </span>
                  </div>

                  {/* Center column: discard + active color */}
                  <div className="flex flex-col items-center gap-3">
                    {/* Discard pile — top card with dramatic presence */}
                    {gs.topCard && (
                      <div className="relative">
                        {/* Shadow card underneath (slight offset for pile depth) */}
                        <div
                          className="absolute"
                          style={{
                            width: compact ? 80 : 110,
                            height: compact ? 118 : 160,
                            borderRadius: compact ? 10 : 14,
                            background: 'rgba(24,24,27,0.8)',
                            top: 3,
                            left: -2,
                            transform: 'rotate(-6deg)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            width: compact ? 80 : 110,
                            height: compact ? 118 : 160,
                            borderRadius: compact ? 10 : 14,
                            background: 'rgba(24,24,27,0.6)',
                            top: 5,
                            left: 4,
                            transform: 'rotate(4deg)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          }}
                        />
                        {/* The actual top card */}
                        <div className="relative" style={{ animation: 'uno-card-enter 0.25s ease-out' }}>
                          <CardFace
                            card={gs.topCard}
                            playable={false}
                            selected={false}
                            compact={compact}
                            large
                          />
                        </div>
                      </div>
                    )}
                    {/* Active color indicator */}
                    {activeColor && <ActiveColorIndicator color={activeColor} compact={compact} />}
                  </div>
                </div>

                {/* Last action feed */}
                {gs.lastAction && (
                  <div className="mt-4 text-center">
                    <span
                      className="italic"
                      style={{
                        fontSize: 11,
                        color: '#a1a1aa',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {gs.lastAction}
                    </span>
                  </div>
                )}
              </div>

              {/* ── My hand ────────────────────────────────────────────── */}
              {myIdx !== null && !mp.isSpectator && gs.phase === 'playing' && (
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ fontSize: compact ? 11 : 13, color: '#a1a1aa' }}>
                      {t('uno.yourHand')}
                    </span>
                    {myIdx !== null && gs.players[myIdx] && (
                      <span className="text-[10px] font-bold" style={{ color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(129,140,248,0.15)' }}>
                        {gs.players[myIdx].matchScore} {t('uno.score')}
                      </span>
                    )}
                    <span
                      className="font-medium"
                      style={{
                        fontSize: 10,
                        color: '#71717a',
                        background: 'rgba(39,39,42,0.6)',
                        padding: '2px 8px',
                        borderRadius: 100,
                        border: '1px solid rgba(63,63,70,0.3)',
                      }}
                    >
                      {myHand.length}
                    </span>
                  </div>

                  {/* Fan layout */}
                  <div
                    className="relative flex items-end justify-center w-full"
                    style={{
                      minHeight: compact ? 90 : 120,
                      paddingBottom: 8,
                      paddingTop: 16,
                    }}
                  >
                    {myHand.map((card, i) => {
                      const playable = isMyTurn && canPlayCard(card);
                      const angle = handFanAngles[i];
                      const yOff = Math.abs(angle) * 0.3;
                      const isSelected = selectedCardId === card.id;

                      return (
                        <div
                          key={card.id}
                          className="transition-all duration-200"
                          style={{
                            marginLeft: i === 0 ? 0 : compact ? -10 : -8,
                            transform: `rotate(${angle}deg) translateY(${isSelected ? -(yOff + 20) : -yOff}px)`,
                            transformOrigin: 'center bottom',
                            zIndex: isSelected ? 50 : i,
                            animation: `uno-card-enter 0.3s ease-out ${i * 40}ms both`,
                          }}
                        >
                          <CardFace
                            card={card}
                            playable={playable}
                            selected={isSelected}
                            onClick={() => {
                              if (playable) {
                                handleCardClick(card);
                              } else {
                                setSelectedCardId(selectedCardId === card.id ? null : card.id);
                              }
                            }}
                            compact={compact}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* UNO call button */}
                  {myHand.length <= 2 && gs.phase === 'playing' && !gs.players[myIdx]?.calledUno && (
                    <button
                      onClick={handleCallUno}
                      className="font-black tracking-wide text-white cursor-pointer border-0 outline-none"
                      style={{
                        padding: compact ? '10px 28px' : '14px 40px',
                        fontSize: compact ? 18 : 22,
                        borderRadius: 16,
                        background: 'linear-gradient(145deg, #dc2626, #b91c1c)',
                        boxShadow: '0 0 24px rgba(239,68,68,0.35), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                        animation: 'uno-uno-throb 1.5s ease-in-out infinite',
                      }}
                    >
                      UNO!
                    </button>
                  )}
                </div>
              )}

              {/* ── End overlay (round_end or match_end) ─────────────── */}
              {endOverlay && (
                <div
                  className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
                  style={{ backgroundColor: endOverlay.kind === 'match_end' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.5)' }}
                >
                  {/* Confetti for match winner */}
                  {endOverlay.kind === 'match_end' && endOverlay.iWon && Array.from({ length: 30 }).map((_, i) => {
                    const size = 6 + (i % 4) * 2;
                    return (
                      <div
                        key={i}
                        className="absolute pointer-events-none"
                        style={{
                          top: -10,
                          left: `${3 + (i * 3.1)}%`,
                          width: size,
                          height: size,
                          borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '1px',
                          backgroundColor: ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8', '#fb923c', '#e879f9'][i % 8],
                          animation: `uno-confetti-fall ${1.8 + (i % 5) * 0.3}s ease-in ${i * 0.06}s forwards`,
                        }}
                      />
                    );
                  })}
                  {/* Loss vignette (match end only) */}
                  {endOverlay.kind === 'match_end' && !endOverlay.iWon && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(159,18,57,0.2) 100%)' }}
                    />
                  )}
                  <div
                    className="text-center pointer-events-auto"
                    style={{
                      minWidth: 280,
                      maxWidth: 380,
                      padding: '36px 40px',
                      borderRadius: 24,
                      background: 'linear-gradient(145deg, rgba(39,39,42,0.95) 0%, rgba(24,24,27,0.97) 100%)',
                      border: '1px solid rgba(63,63,70,0.4)',
                      boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(12px)',
                      animation: 'uno-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    {endOverlay.kind === 'round_end' ? (
                      <>
                        <p className="font-bold mb-1" style={{ fontSize: 32, color: endOverlay.iWon ? '#818cf8' : '#fbbf24' }}>
                          {t('uno.roundEnd')}
                        </p>
                        <p className="font-semibold mb-1" style={{ fontSize: 15, color: '#d4d4d8' }}>
                          {endOverlay.winnerNick} — +{endOverlay.points} {t('uno.points')}
                        </p>
                        {/* Scoreboard */}
                        <div className="flex flex-col gap-1 mb-4 mt-3">
                          {gs && [...gs.players].sort((a, b) => b.matchScore - a.matchScore).map((p) => (
                            <div
                              key={p.token}
                              className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                              style={{
                                background: p.token === gs.roundWinner ? 'rgba(99,102,241,0.1)' : 'rgba(39,39,42,0.5)',
                                border: p.token === gs.roundWinner ? '1px solid rgba(129,140,248,0.2)' : '1px solid rgba(63,63,70,0.3)',
                              }}
                            >
                              <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>{p.nickname || 'Player'}</span>
                              <span className="text-sm font-bold" style={{ color: '#a5b4fc' }}>{p.matchScore}</span>
                            </div>
                          ))}
                        </div>
                        {myIdx === 0 ? (
                          <button
                            onClick={() => mp.sendAction({ type: 'UNO_NEXT_ROUND' })}
                            className="w-full font-semibold text-sm text-white transition-all cursor-pointer border-0 outline-none active:scale-[0.98]"
                            style={{
                              padding: '11px 20px',
                              borderRadius: 12,
                              background: 'linear-gradient(145deg, #16a34a, #15803d)',
                              boxShadow: '0 4px 12px rgba(22,163,74,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                          >
                            {t('uno.nextRound')}
                          </button>
                        ) : (
                          <p className="text-sm" style={{ color: '#71717a' }}>{t('uno.waitingNextRound')}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p
                          className="font-bold mb-3"
                          style={{ fontSize: 42, color: endOverlay.iWon ? '#818cf8' : '#fb7185' }}
                        >
                          {endOverlay.iWon ? '🏆' : '💀'}
                        </p>
                        <p
                          className="font-black mb-2"
                          style={{ fontSize: 20, color: '#f4f4f5' }}
                        >
                          {endOverlay.iWon
                            ? t('uno.youWin')
                            : `${endOverlay.winnerNick} ${t('uno.wins')}`}
                        </p>
                        {/* Final scoreboard */}
                        <div className="flex flex-col gap-1 mb-4 mt-2">
                          {gs && [...gs.players].sort((a, b) => b.matchScore - a.matchScore).map((p, rank) => (
                            <div
                              key={p.token}
                              className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                              style={{
                                background: rank === 0 ? 'rgba(99,102,241,0.1)' : 'rgba(39,39,42,0.5)',
                                border: rank === 0 ? '1px solid rgba(129,140,248,0.2)' : '1px solid rgba(63,63,70,0.3)',
                              }}
                            >
                              <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>{p.nickname || 'Player'}</span>
                              <span className="text-sm font-bold" style={{ color: '#a5b4fc' }}>{p.matchScore}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <button
                            onClick={mp.requestRematch}
                            className="w-full font-semibold text-sm text-white transition-all cursor-pointer border-0 outline-none active:scale-[0.98]"
                            style={{
                              padding: '11px 20px',
                              borderRadius: 12,
                              background: 'linear-gradient(145deg, #4f46e5, #4338ca)',
                              boxShadow: '0 4px 12px rgba(79,70,229,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                          >
                            {t('game.actions.rematch')}
                          </button>
                          <button
                            onClick={mp.leaveRoom}
                            className="w-full text-sm transition-all cursor-pointer outline-none active:scale-[0.98]"
                            style={{
                              padding: '9px 16px',
                              borderRadius: 12,
                              background: 'transparent',
                              border: '1px solid rgba(63,63,70,0.5)',
                              color: '#a1a1aa',
                            }}
                          >
                            {t('game.actions.leaveRoom')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Leave button */}
          {mp.phase !== 'lobby' && !endOverlay && (
            <button
              onClick={mp.leaveRoom}
              className="mt-1 transition-colors cursor-pointer"
              style={{ fontSize: 11, color: '#52525b' }}
            >
              {t('game.actions.leaveRoom')}
            </button>
          )}

          {/* Color picker overlay */}
          {showColorPicker && <ColorPicker onPick={handleColorPick} pt={t} />}
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────── */}
        <aside className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'} lg:sticky lg:top-24 h-fit`}>
          {/* Connection status */}
          <div
            className="flex items-center gap-2 text-xs"
            style={{
              padding: compact ? '8px 12px' : '10px 16px',
              borderRadius: 12,
              background: 'rgba(24,24,27,0.6)',
              border: '1px solid rgba(63,63,70,0.3)',
            }}
          >
            <span
              className="rounded-full"
              style={{
                width: 7,
                height: 7,
                background: mp.connection === 'connected' ? '#34d399'
                  : mp.connection === 'connecting' ? '#fbbf24'
                  : '#f43f5e',
                boxShadow: mp.connection === 'connecting' ? '0 0 6px rgba(251,191,36,0.4)' : 'none',
                animation: mp.connection === 'connecting' ? 'uno-glow-pulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: '#a1a1aa' }}>{t(`status.${mp.connection}`)}</span>
          </div>

          {/* Error */}
          {mp.error && (
            <div
              className="text-sm"
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(159,18,57,0.1)',
                border: '1px solid rgba(244,63,94,0.2)',
                color: '#fda4af',
              }}
            >
              {mp.error}
            </div>
          )}

          {/* Lobby UI */}
          {mp.phase === 'lobby' && isQuickPlay ? (
            <div
              className="flex flex-col items-center gap-3"
              style={{
                padding: '24px 16px',
                borderRadius: 12,
                background: 'rgba(24,24,27,0.6)',
                border: '1px solid rgba(63,63,70,0.3)',
              }}
            >
              <div
                className="rounded-full animate-spin"
                style={{
                  width: 24,
                  height: 24,
                  border: '2px solid rgba(129,140,248,0.3)',
                  borderTopColor: '#818cf8',
                }}
              />
              <p className="text-sm" style={{ color: '#a1a1aa' }}>{t('game.lobby.findingMatch')}</p>
            </div>
          ) : mp.phase === 'lobby' ? (
            <div
              className="flex flex-col gap-3"
              style={{
                padding: '16px',
                borderRadius: 12,
                background: 'rgba(24,24,27,0.6)',
                border: '1px solid rgba(63,63,70,0.3)',
              }}
            >
              <NicknameEditor
                nickname={mp.myNickname}
                onSave={(nick) => mp.setNickname(nick)}
              />

              {/* Visibility toggle */}
              <div className="flex gap-1 p-1 rounded-lg bg-zinc-800">
                {(['private', 'public'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setRoomVisibility(v)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      roomVisibility === v ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t(`game.lobby.${v}`)}
                  </button>
                ))}
              </div>

              {roomVisibility === 'public' && (
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={t('game.lobby.roomName')}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500"
                />
              )}

              {/* Max players */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{t('uno.maxPlayers')}</span>
                <div className="flex gap-1">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxPlayers(n)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                        maxPlayers === n ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target score */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{t('uno.targetScore')}</span>
                <div className="flex gap-1">
                  {UNO_TARGET_SCORES.map((sc) => (
                    <button
                      key={sc}
                      onClick={() => setTargetScore(sc)}
                      className={`px-2.5 h-8 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                        targetScore === sc ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>

              {/* House rules */}
              <div
                className="flex flex-col gap-2"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(39,39,42,0.5)',
                  border: '1px solid rgba(63,63,70,0.3)',
                }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#71717a' }}>{t('uno.rules')}</span>
                {([
                  [stackDraw2, setStackDraw2, 'uno.rules.stackDraw2'] as const,
                  [stackDraw4, setStackDraw4, 'uno.rules.stackDraw4'] as const,
                  [allowDraw4OnDraw2, setAllowDraw4OnDraw2, 'uno.rules.allowDraw4OnDraw2'] as const,
                  [allowDraw2OnDraw4, setAllowDraw2OnDraw4, 'uno.rules.allowDraw2OnDraw4'] as const,
                  [playDrawnCard, setPlayDrawnCard, 'uno.rules.playDrawnCard'] as const,
                  [drawUntilPlayable, setDrawUntilPlayable, 'uno.rules.drawUntilPlayable'] as const,
                  [forcedPlay, setForcedPlay, 'uno.rules.forcedPlay'] as const,
                ]).map(([val, setter, key]) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs text-zinc-300 group-hover:text-zinc-100 transition-colors select-none">{t(key)}</span>
                    <button
                      type="button"
                      onClick={() => (setter as (v: boolean) => void)(!val)}
                      className="relative shrink-0 cursor-pointer"
                      style={{
                        width: 34,
                        height: 18,
                        borderRadius: 9,
                        background: val ? '#4f46e5' : '#3f3f46',
                        border: `1px solid ${val ? 'rgba(99,102,241,0.4)' : 'rgba(63,63,70,0.5)'}`,
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: val ? 17 : 2,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          background: val ? '#c7d2fe' : '#71717a',
                          transition: 'left 0.15s, background 0.15s',
                        }}
                      />
                    </button>
                  </label>
                ))}
              </div>

              <button
                onClick={() => mp.createRoom({ visibility: roomVisibility, roomName: roomName.trim() || undefined, maxPlayers, unoConfig: { targetScore, stackDraw2, stackDraw4, allowDraw2OnDraw4, allowDraw4OnDraw2, playDrawnCardImmediately: playDrawnCard, drawUntilPlayable, forcedPlay } })}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer active:scale-[0.98]"
              >
                {t('game.lobby.createRoom')}
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-zinc-700" />
                <span className="text-xs text-zinc-500">{t('uno.or')}</span>
                <div className="flex-1 h-px bg-zinc-700" />
              </div>

              <div className="flex gap-2">
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder={t('game.lobby.roomCode')}
                  maxLength={6}
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 uppercase tracking-widest font-mono"
                />
                <button
                  onClick={() => mp.joinRoom(joinInput.trim())}
                  disabled={joinInput.trim().length < 6}
                  className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {t('game.lobby.join')}
                </button>
              </div>
            </div>
          ) : null}

          {/* Room info */}
          {mp.roomCode && mp.phase !== 'lobby' && (
            <div
              className="flex flex-col gap-2"
              style={{
                padding: compact ? '8px 12px' : '12px 16px',
                borderRadius: 12,
                background: 'rgba(24,24,27,0.6)',
                border: '1px solid rgba(63,63,70,0.3)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('game.room.title')}</span>
                <span className={`font-mono ${compact ? 'text-lg' : 'text-xl'} font-black tracking-widest text-zinc-100`}>{mp.roomCode}</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/games/uno?room=${mp.roomCode}`)}
                className="w-full py-1.5 rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                {t('game.room.copyInvite')}
              </button>
            </div>
          )}

          {/* Game info */}
          <div
            className="text-xs"
            style={{
              padding: compact ? '8px 12px' : '12px 16px',
              borderRadius: 12,
              background: 'rgba(24,24,27,0.6)',
              border: '1px solid rgba(63,63,70,0.3)',
              color: '#71717a',
            }}
          >
            {t('modal.controls.uno')}
          </div>

          {/* Chat */}
          {mp.phase !== 'lobby' && (
            <ChatPanel
              mode="both"
              roomCode={mp.roomCode}
              roomMessages={mp.roomMessages}
              globalMessages={mp.globalMessages}
              chatError={mp.chatError}
              onSend={mp.sendChat}
              collapsible
              open={chatOpen}
              onOpenChange={(open) => {
                setChatOpen(open);
                if (open) setUnread(0);
              }}
              showUnreadBadge={unread > 0}
            />
          )}
        </aside>
      </div>
    </>
  );
}
