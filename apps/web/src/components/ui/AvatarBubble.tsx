'use client';

import { useId } from 'react';
import type { CosmeticsSelection } from 'shared';
import { getAvatarById } from '@/lib/avatars';
import { getFrameAnimClass, getFrameClass } from '@/lib/avatarFrames';
import { getCosmeticDef } from '@/lib/cosmetics';

const SIZE_CLASSES = {
  sm: 'w-5 h-5 text-xs',
  md: 'w-7 h-7 text-sm',
  lg: 'w-10 h-10 text-lg',
} as const;

export interface AvatarBubbleProps {
  avatarId?: string;
  avatarFrame?: string;
  nickname?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Unified cosmetics — primary source of truth when provided */
  cosmetics?: CosmeticsSelection;
}

/** Mapping of head cosmetic IDs to their display emoji */
const HEAD_EMOJIS: Record<string, string> = {
  crown: '👑',
  cap: '🧢',
  wizard_hat: '🧙',
  top_hat: '🎩',
};

/** Head emoji positions by avatar size */
const HEAD_POSITION: Record<string, string> = {
  sm: 'text-[8px] -top-1 -right-0.5',
  md: 'text-[10px] -top-1.5 -right-1',
  lg: 'text-xs -top-2 -right-1',
};

/**
 * Two-layer animated SVG flame effect.
 *
 * Layer 1 — Base flame ring: turbulence-distorted ring with warm gradient
 * (white-hot center → orange → deep red → transparent).
 *
 * Layer 2 — Rising flame tongues: small ellipses placed around the ring that
 * animate upward with opacity flicker, giving the illusion of flames rising.
 */
function FireFlameRing() {
  const raw = useId();
  const uid = raw.replace(/:/g, '');
  const fId = `ff${uid}`;
  const mId = `fm${uid}`;
  const gId = `fg${uid}`;
  const blurId = `fb${uid}`;
  const tgId = `tg${uid}`;
  const tmId = `tm${uid}`;

  const tongues: { cx: number; cy: number; angle: number; delay: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * 45;
    const rad = (angle * Math.PI) / 180;
    const r = 42;
    tongues.push({
      cx: 50 + r * Math.cos(rad),
      cy: 50 + r * Math.sin(rad),
      angle,
      delay: `${(i * 0.375).toFixed(2)}s`,
    });
  }

  return (
    <svg
      aria-hidden="true"
      className="absolute pointer-events-none wg-flame-svg"
      style={{
        inset: '-8px',
        width: 'calc(100% + 16px)',
        height: 'calc(100% + 16px)',
      }}
      viewBox="0 0 100 100"
    >
      <defs>
        <filter id={fId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035 0.06"
            numOctaves="3"
            result="noise"
          >
            <animate
              attributeName="seed"
              values="0;4;8;12;16;20;24;28;32;36;40;44;48"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="9"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <radialGradient id={gId}>
          <stop offset="52%" stopColor="transparent" />
          <stop offset="64%" stopColor="#fff7b0" stopOpacity="0.85" />
          <stop offset="73%" stopColor="#ffb347" stopOpacity="0.8" />
          <stop offset="83%" stopColor="#ff5a1f" stopOpacity="0.55" />
          <stop offset="93%" stopColor="#cc2200" stopOpacity="0.25" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        <mask id={mId}>
          <rect width="100" height="100" fill="black" />
          <circle cx="50" cy="50" r="48" fill="white" />
          <circle cx="50" cy="50" r="35" fill="black" />
        </mask>

        <radialGradient id={tgId}>
          <stop offset="0%" stopColor="#fff7b0" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ffb347" stopOpacity="0.7" />
          <stop offset="75%" stopColor="#ff5a1f" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        <mask id={tmId}>
          <rect width="100" height="100" fill="black" />
          <circle cx="50" cy="50" r="50" fill="white" />
          <circle cx="50" cy="50" r="33" fill="black" />
        </mask>

        <filter id={blurId}>
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>

      <circle
        cx="50"
        cy="50"
        r="46"
        fill={`url(#${gId})`}
        mask={`url(#${mId})`}
        filter={`url(#${fId})`}
      />

      <g mask={`url(#${tmId})`} filter={`url(#${blurId})`}>
        {tongues.map((pt, i) => (
          <ellipse
            key={i}
            cx={pt.cx}
            cy={pt.cy}
            rx="4.5"
            ry="7"
            fill={`url(#${tgId})`}
            transform={`rotate(${pt.angle - 90} ${pt.cx} ${pt.cy})`}
            className="wg-flame-tongue"
            style={{ animationDelay: pt.delay }}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Resolve the effective cosmetics values from props.
 * Priority: cosmetics object > legacy individual props > undefined.
 */
function resolveCosmetics(props: AvatarBubbleProps) {
  const { cosmetics, avatarId, avatarFrame } = props;

  // Avatar ID: cosmetics first, then legacy prop
  const resolvedAvatarId = cosmetics?.avatarId ?? avatarId;

  // Frame: cosmetics.slots.frame first, then legacy avatarFrame prop
  const resolvedFrame = cosmetics?.slots?.frame ?? avatarFrame;

  // New cosmetic slots — only from cosmetics object (no legacy props for these)
  const resolvedHead = cosmetics?.slots?.head;
  const resolvedPortal = cosmetics?.slots?.portal;
  const resolvedAura = cosmetics?.slots?.aura;

  return { resolvedAvatarId, resolvedFrame, resolvedHead, resolvedPortal, resolvedAura };
}

export function AvatarBubble({ avatarId, avatarFrame, nickname, size = 'md', className = '', cosmetics }: AvatarBubbleProps) {
  const { resolvedAvatarId, resolvedFrame, resolvedHead, resolvedPortal, resolvedAura } = resolveCosmetics({ avatarId, avatarFrame, cosmetics });

  const avatarDef = resolvedAvatarId ? getAvatarById(resolvedAvatarId) : undefined;
  const sizeClass = SIZE_CLASSES[size];
  const isFire = resolvedFrame === 'fire';
  const animClass = getFrameAnimClass(resolvedFrame);
  const staticClass = getFrameClass(resolvedFrame);

  const hasFrame = !!(resolvedFrame && resolvedFrame !== 'none');
  const borderFallback = hasFrame ? staticClass : (avatarDef ? 'border border-zinc-700' : '');
  const bgClass = avatarDef ? 'bg-zinc-800' : 'bg-indigo-600';
  const content = avatarDef ? avatarDef.emoji : (nickname?.charAt(0).toUpperCase() || '?');
  const textExtra = avatarDef ? '' : 'font-black text-white';

  // Any cosmetic layer that renders outside the bubble boundary needs overflow-visible
  const hasExternalLayers = !!(resolvedPortal || resolvedAura || resolvedHead || isFire || hasFrame);

  return (
    <span
      className={`relative ${animClass} ${sizeClass} rounded-full ${bgClass} ${borderFallback} flex items-center justify-center shrink-0 select-none leading-none ${textExtra} ${hasExternalLayers ? 'overflow-visible' : ''} ${className}`}
      title={nickname}
    >
      {/* Layer 1: Portal (rotating gradient ring behind everything) */}
      {resolvedPortal && <span className={`wg-portal-${resolvedPortal}`} />}

      {/* Layer 2: Aura (ambient glow around the bubble) */}
      {resolvedAura && <span className={`wg-aura-${resolvedAura}`} />}

      {/* Layer 3: Fire frame SVG (only for fire frame) */}
      {isFire && <FireFlameRing />}

      {/* Layer 4: Content (avatar emoji or letter initial) */}
      {(isFire || resolvedPortal || resolvedAura) ? (
        <span className="relative z-10">{content}</span>
      ) : (
        content
      )}

      {/* Layer 5: Head cosmetic (emoji overlay on top-right) */}
      {resolvedHead && HEAD_EMOJIS[resolvedHead] && (
        <span className={`absolute z-20 leading-none pointer-events-none select-none ${HEAD_POSITION[size] || HEAD_POSITION.md}`}>
          {HEAD_EMOJIS[resolvedHead]}
        </span>
      )}
    </span>
  );
}
