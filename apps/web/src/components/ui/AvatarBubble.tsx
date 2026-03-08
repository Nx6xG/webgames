'use client';

import { useId } from 'react';
import type { CosmeticsSelection } from 'shared';
import { getAvatarById } from '@/lib/avatars';
import { getFrameAnimClass, getFrameClass } from '@/lib/avatarFrames';
import { getCosmeticDef } from '@/lib/cosmetics';
import { SvgAvatar, hasSvgAvatar } from '@/components/ui/SvgAvatars';
import { SvgHeadCosmetic, hasHeadSvg } from '@/components/ui/SvgHeadCosmetics';

const SIZE_CLASSES = {
  sm: 'w-5 h-5 text-xs',
  md: 'w-7 h-7 text-sm',
  lg: 'w-10 h-10 text-lg',
  xl: 'w-16 h-16 text-3xl',
} as const;

/** SVG avatar sizing — percentage of container (no bg circle, so fill more) */
const SVG_SIZE: Record<string, string> = {
  sm: 'w-[90%] h-[90%]',
  md: 'w-[90%] h-[90%]',
  lg: 'w-[90%] h-[90%]',
  xl: 'w-[90%] h-[90%]',
};

export interface AvatarBubbleProps {
  avatarId?: string;
  avatarFrame?: string;
  nickname?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Unified cosmetics — primary source of truth when provided */
  cosmetics?: CosmeticsSelection;
}

/** Head cosmetic font size per avatar size */
const HEAD_TEXT_SIZE: Record<string, string> = {
  sm: 'text-[10px]',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-2xl',
};

/** Scale multiplier per avatar size (compounds with per-item anchor.scale) */
const HEAD_SIZE_SCALE: Record<string, number> = {
  sm: 0.75,
  md: 0.9,
  lg: 1.0,
  xl: 1.2,
};

/** SVG head cosmetic width per avatar size */
const HEAD_SVG_WIDTH: Record<string, string> = {
  sm: '16px',
  md: '22px',
  lg: '32px',
  xl: '52px',
};

/** Default top offset — sits just above the frame's upper rim */
const HEAD_DEFAULT_TOP = '-28%';

/**
 * Two-layer animated SVG flame effect.
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
  const textExtra = avatarDef ? '' : 'font-black text-white';

  // Check if this avatar has an SVG version
  const useSvg = resolvedAvatarId && hasSvgAvatar(resolvedAvatarId);
  const emojiContent = avatarDef ? avatarDef.emoji : (nickname?.charAt(0).toUpperCase() || '?');

  // Any cosmetic layer that renders outside the bubble boundary needs overflow-visible
  const hasExternalLayers = !!(resolvedPortal || resolvedAura || resolvedHead || isFire || hasFrame);

  return (
    <span
      className={`relative ${animClass} ${sizeClass} rounded-full ${bgClass} ${borderFallback} flex items-center justify-center shrink-0 select-none leading-none ${textExtra} ${hasExternalLayers ? 'overflow-visible' : ''} ${className}`}
      title={nickname}
    >
      {/* Layer 1: Avatar Background (portal) — fills behind avatar */}
      {resolvedPortal && <span className={`wg-bg-${resolvedPortal}`} />}

      {/* Layer 2: Aura (ambient glow around the bubble) */}
      {resolvedAura && <span className={`wg-aura-${resolvedAura}`} />}

      {/* Layer 3: Fire frame SVG (only for fire frame) */}
      {isFire && <FireFlameRing />}

      {/* Layer 4: Content (SVG avatar, emoji, or letter initial) */}
      {useSvg ? (
        <span className={`relative z-10 flex items-center justify-center ${SVG_SIZE[size] ?? SVG_SIZE.md}`}>
          <SvgAvatar avatarId={resolvedAvatarId!} className="w-full h-full" />
        </span>
      ) : (isFire || resolvedPortal || resolvedAura) ? (
        <span className="relative z-10">{emojiContent}</span>
      ) : (
        emojiContent
      )}

      {/* Layer 5: Head cosmetic (anchored to top edge of frame) */}
      {resolvedHead && (() => {
        const def = getCosmeticDef(resolvedHead, 'head');
        if (!def) return null;
        const useSvgHead = hasHeadSvg(resolvedHead);
        const anchor = def.anchor;
        const sizeScale = HEAD_SIZE_SCALE[size] ?? 0.9;
        const itemScale = anchor?.scale ?? 1;
        const totalScale = sizeScale * itemScale;
        const top = anchor?.top ?? HEAD_DEFAULT_TOP;
        const left = anchor?.left ?? '50%';
        const rotate = anchor?.rotate;

        if (useSvgHead) {
          // SVG head cosmetic — sized relative to the avatar bubble
          const svgWidth = HEAD_SVG_WIDTH[size] ?? HEAD_SVG_WIDTH.md;
          const transforms = ['translateX(-50%)'];
          if (totalScale !== 1) transforms.push(`scale(${totalScale})`);
          if (rotate) transforms.push(`rotate(${rotate})`);
          return (
            <span
              className="absolute z-20 pointer-events-none select-none"
              style={{ top, left, width: svgWidth, transform: transforms.join(' ') }}
            >
              <SvgHeadCosmetic headId={resolvedHead} className="w-full h-auto" />
            </span>
          );
        }

        // Fallback: emoji head cosmetic
        const emojiTransforms = ['translateX(-50%)'];
        if (totalScale !== 1) emojiTransforms.push(`scale(${totalScale})`);
        if (rotate) emojiTransforms.push(`rotate(${rotate})`);
        return (
          <span
            className={`absolute z-20 leading-none pointer-events-none select-none ${HEAD_TEXT_SIZE[size] ?? HEAD_TEXT_SIZE.md}`}
            style={{ top, left, transform: emojiTransforms.join(' ') }}
          >
            {def.emoji}
          </span>
        );
      })()}
    </span>
  );
}
